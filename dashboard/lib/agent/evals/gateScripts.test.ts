// The phase 1 gate's scripted model turns (gateScripts.ts), checked in the default lane:
// the gate itself (phase1.db.test.ts) runs only in CI's db lane. Every script is played
// against stand-in prompts; each tool call must name a real tool and pass its input
// schema, each present payload must pass the variant 1 grammar, and each approval the
// scenario answers must be the last call of the turn before it.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asSchema } from "ai";
import type { LanguageModelV4Prompt, LanguageModelV4StreamPart } from "@ai-sdk/provider";

vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), withUserMutation: vi.fn(), withUserPayloadMutation: vi.fn(), serviceSql: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }));

import { buildTools, type ToolCtx } from "@/lib/agent/tools";
import { emptyGathered } from "@/lib/agent/gathered";
import { resetApprovalSecretWarning } from "@/lib/agent/approvalSecret";
import { SurfacePayloadV1Schema } from "@/lib/agent/surfaces/v1/blocks";
import { PERSONAS } from "@/lib/agent/evals/personas";
import { SCENARIOS, SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import { GATE_PERSONAS, gateScript, jobIdsIn, proposalIdIn } from "@/lib/agent/evals/gateScripts";

const PROPOSAL = "9a000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", "t".repeat(40)); // low-entropy fixture
  resetApprovalSecretWarning();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const ctx = (): ToolCtx => ({
  userId: "e7a10000-0000-4000-8000-000000000009",
  email: null,
  threadId: "7d000000-0000-4000-8000-000000000009",
  runId: "8b000000-0000-4000-8000-000000000009",
  variant: 1,
  unattended: false,
  gathered: emptyGathered(),
  repairsLeft: { n: 1 }, views: { used: 0 },
});

/** A prompt whose tool results hold the persona's top jobs and one memo proposal, as the real tools return them. */
function standInPrompt(jobIds: string[]): LanguageModelV4Prompt {
  return [
    { role: "user", content: [{ type: "text", text: "stand-in" }] },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "r1",
          toolName: "search_jobs",
          output: { type: "json", value: { rows: jobIds.map((jobId) => ({ jobId })), total: jobIds.length } },
        },
        {
          type: "tool-result",
          toolCallId: "r2",
          toolName: "propose_memo_change",
          output: { type: "json", value: { status: "done", proposalId: PROPOSAL, diff: [] } },
        },
      ],
    },
  ];
}

type ToolCallPart = Extract<LanguageModelV4StreamPart, { type: "tool-call" }>;
const toolCallsOf = (chunks: LanguageModelV4StreamPart[]) => chunks.filter((c): c is ToolCallPart => c.type === "tool-call");

/** How many POSTs a scenario makes: a memo.resolve press goes through the intent handler, not the route. */
const turnsOf = (id: (typeof SCENARIO_IDS)[number]) => SCENARIOS[id].steps.filter((s) => s.kind !== "memo_resolve").length;

describe("gate scripts", () => {
  test.each(SCENARIO_IDS)("%s: every call is a real tool with a valid input, every surface passes the grammar", async (id) => {
    const persona = PERSONAS[GATE_PERSONAS[id]];
    const script = gateScript(id, persona);
    expect(script.turns).toHaveLength(turnsOf(id));
    const tools: Record<string, { inputSchema: unknown }> = buildTools(ctx());
    const prompt = standInPrompt(persona.jobs.slice(0, 10).map((j) => j.jobId));
    const lastCalls: string[] = [];
    for (const turn of script.turns) {
      let last = "";
      for (const step of turn) {
        for (const c of toolCallsOf(step(prompt))) {
          const tool = tools[c.toolName];
          expect(tool, c.toolName).toBeDefined();
          const input: unknown = JSON.parse(c.input);
          const valid = await asSchema(tool.inputSchema as Parameters<typeof asSchema>[0]).validate?.(input);
          expect(valid?.success, `${c.toolName} ${c.input}`).toBe(true);
          if (c.toolName === "present") {
            const payload = (input as { payload: unknown }).payload;
            const parsed = SurfacePayloadV1Schema.safeParse(payload);
            expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
          }
          last = c.toolName;
        }
      }
      lastCalls.push(last);
    }
    expect(script.errors).toEqual([]);
    // Each approve step answers the call that ended the turn before it.
    let turnIndex = -1;
    for (const step of SCENARIOS[id].steps) {
      if (step.kind === "memo_resolve") continue;
      if (step.kind === "approve") expect(lastCalls[turnIndex], `${id} approves ${step.tool}`).toBe(step.tool);
      turnIndex += 1;
    }
  });

  test("ids come from the prompt's tool results, and a missing result is a script error", () => {
    const persona = PERSONAS[GATE_PERSONAS.a_resume_upload];
    const ids = persona.jobs.slice(0, 4).map((j) => j.jobId);
    expect(jobIdsIn(standInPrompt(ids), "search_jobs")).toEqual(ids);
    expect(proposalIdIn(standInPrompt(ids))).toBe(PROPOSAL);

    const empty: LanguageModelV4Prompt = [{ role: "user", content: [{ type: "text", text: "nothing read" }] }];
    const script = gateScript("a_resume_upload", persona);
    for (const step of script.turns[2]) step(empty);
    for (const step of script.turns[3]) step(empty);
    expect(script.errors).toEqual([
      "a_resume_upload: no proposal id in the propose_memo_change result",
      "a_resume_upload: search_jobs found no jobs",
    ]);
  });
});
