// Plays one golden scenario's steps against a thread (plan Task 1.22): messages and the
// compare message go through `runTurn` (POST /api/agent in the phase 1 gate,
// streamAgentTurn directly in the live harness), approvals answer the pending part the
// model asked for, and a memo.resolve press goes through the host's own intent handler
// on the newest MemoDiff surface. What the user sent is returned for the Recording.
//
// A step the model gave no occasion for (no pending approval, no MemoDiff surface) is
// skipped and named in `skipped`: a live model may take another path, and the asserts
// then judge the outcome. The phase 1 gate expects no skipped step.
import { getToolName, isToolUIPart } from "ai";
import type { TurnInput } from "@/lib/agent/loop";
import { loadMessages } from "@/lib/agent/threads";
import { listThreadSurfaces } from "@/lib/agent/surfaces/store";
import { executeIntent } from "@/lib/agent/actions/handlers";
import { compareMessage } from "@/lib/agent/actions/compareText";
import { SurfacePayloadV1Schema } from "@/lib/agent/surfaces/v1/blocks";
import type { ApprovalToolName } from "@/lib/agent/tools/approval";
import type { Persona } from "@/lib/agent/evals/personas";
import type { Scenario } from "@/lib/agent/evals/scenarios";
import type { ApprovalDecision, IntentPress } from "@/lib/agent/evals/recording";

export interface TurnResult {
  status: number;
  /** Milliseconds from the request to the end of its stream (persistence included). */
  ms: number;
  /** Milliseconds from the request to the first stored surface's output in the stream, or null. */
  firstRenderMs: number | null;
}

export type TurnRunner = (input: TurnInput) => Promise<TurnResult>;

export interface PlayResult {
  approvals: ApprovalDecision[];
  intents: IntentPress[];
  turns: TurnResult[];
  skipped: string[];
  timings: { firstRenderMs: number | null; completeMs: number };
}

/** The pending approval id of `tool` in the thread's last assistant message, or null. */
export async function pendingApprovalId(userId: string, threadId: string, tool: ApprovalToolName): Promise<string | null> {
  const last = (await loadMessages(userId, threadId)).at(-1);
  if (!last || last.role !== "assistant") return null;
  for (const part of last.parts) {
    if (isToolUIPart(part) && getToolName(part) === tool && part.state === "approval-requested") return part.approval.id;
  }
  return null;
}

/** The newest surface in the thread with a MemoDiff block: its id and proposal. */
export async function newestMemoDiff(userId: string, threadId: string): Promise<{ surfaceId: string; proposalId: string } | null> {
  const surfaces = await listThreadSurfaces(userId, threadId);
  for (const s of [...surfaces].reverse()) {
    const payload = SurfacePayloadV1Schema.safeParse(s.payload);
    if (!payload.success) continue;
    for (const block of payload.data.blocks) {
      if (block.type === "MemoDiff") return { surfaceId: s.id, proposalId: block.proposalId };
    }
  }
  return null;
}

export async function playScenario(a: {
  scenario: Scenario;
  persona: Persona;
  userId: string;
  email: string | null;
  threadId: string;
  runTurn: TurnRunner;
}): Promise<PlayResult> {
  const out: PlayResult = { approvals: [], intents: [], turns: [], skipped: [], timings: { firstRenderMs: null, completeMs: 0 } };
  const turn = async (input: TurnInput) => {
    const res = await a.runTurn(input);
    out.turns.push(res);
    out.timings.completeMs += res.ms;
    if (out.timings.firstRenderMs === null && res.firstRenderMs !== null) {
      out.timings.firstRenderMs = out.timings.completeMs - res.ms + res.firstRenderMs;
    }
  };

  for (const [i, step] of a.scenario.steps.entries()) {
    const id = `m-${a.scenario.id}-${i}`;
    if (step.kind === "message") {
      await turn({ kind: "message", id, text: step.text, documentIds: step.attachResume ? [a.persona.documentId] : [] });
    } else if (step.kind === "compare") {
      const [x, y] = step.jobs.map((k) => a.persona.jobs[k].jobId);
      await turn({ kind: "message", id, text: compareMessage(x, y), documentIds: [] });
    } else if (step.kind === "approve") {
      const approvalId = await pendingApprovalId(a.userId, a.threadId, step.tool);
      if (approvalId === null) {
        out.skipped.push(`step ${i}: no pending ${step.tool} approval`);
        continue;
      }
      out.approvals.push({ approvalId, approved: step.approved });
      await turn({ kind: "approval", approvalId, approved: step.approved });
    } else {
      const diff = await newestMemoDiff(a.userId, a.threadId);
      if (diff === null) {
        out.skipped.push(`step ${i}: no MemoDiff surface to ${step.decision}`);
        continue;
      }
      const intent = { name: "memo.resolve", proposalId: diff.proposalId, decision: step.decision };
      const outcome = await executeIntent(a.userId, {
        threadId: a.threadId,
        surfaceId: diff.surfaceId,
        raw: intent,
        source: "host",
        email: a.email,
      });
      out.intents.push({ surfaceId: diff.surfaceId, intent, outcome: outcome.kind });
    }
  }
  return out;
}

/**
 * Reads a UI message stream to its end, timing the first stored surface: the first
 * tool output that carries a surfaceId (present's output).
 */
export async function readStream(res: Response, startedAt: number): Promise<{ text: string; firstRenderMs: number | null }> {
  if (!res.body) return { text: await res.text(), firstRenderMs: null };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let firstRenderMs: number | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (firstRenderMs === null && /"type":"tool-output-available"[^\n]*"surfaceId"/.test(text)) {
      firstRenderMs = Date.now() - startedAt;
    }
  }
  text += decoder.decode();
  return { text, firstRenderMs };
}
