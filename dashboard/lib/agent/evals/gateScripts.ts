// The scripted model turns of the phase 1 gate (plan Task 1.24, lib/agent/phase1.db.test.ts):
// for each golden scenario, what a well-behaved model does turn by turn, as stream parts
// a MockLanguageModelV4 plays. Ids the model could only learn from a tool result (the
// jobs search_jobs found, the proposal propose_memo_change created) are read from the
// prompt, as a real model reads them, so a tool that returned nothing shows up as a
// script error rather than as an invented id.
//
// Pure: no database and no SDK runtime. gateScripts.test.ts runs every script against
// stand-in prompts in the default lane and checks each present payload against the
// variant 1 grammar, since the gate itself runs only in CI's db lane.
import type { LanguageModelV4Prompt, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { Persona, PersonaId } from "@/lib/agent/evals/personas";
import type { ScenarioId } from "@/lib/agent/evals/scenarios";

/** The persona each scenario runs for in the gate (the same as its hand-written recording). */
export const GATE_PERSONAS: Record<ScenarioId, PersonaId> = {
  a_resume_upload: "new-grad",
  b_compare: "senior-backend",
  c_prep: "career-switcher",
  d_weekly: "new-grad",
};

/** One model call: the stream parts it answers with, given the prompt it was sent. */
export type ScriptStep = (prompt: LanguageModelV4Prompt) => LanguageModelV4StreamPart[];
/** One POST /api/agent: its model calls in order. */
export type ScriptTurn = ScriptStep[];

export interface GateScript {
  turns: ScriptTurn[];
  /** What the script could not find in a prompt; the gate expects none. */
  errors: string[];
}

const usage = {
  inputTokens: { total: 40, noCache: 40, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 8, text: 8, reasoning: undefined },
};
/** The billed cost of one step, in the shape the budget code reads (providerMetadata.openrouter.usage.cost). */
const billed = { openrouter: { usage: { cost: 0.0005 } } };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The output of the newest tool-result of `toolName` in the prompt, as JSON text ("" when none). */
export function lastToolOutput(prompt: LanguageModelV4Prompt, toolName: string): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i];
    if (message.role !== "tool") continue;
    for (const part of message.content) {
      if (part.type === "tool-result" && part.toolName === toolName) return JSON.stringify(part.output);
    }
  }
  return "";
}

/** The job ids in the newest result of `toolName`, in order, without repeats. */
export function jobIdsIn(prompt: LanguageModelV4Prompt, toolName: string): string[] {
  const ids = [...lastToolOutput(prompt, toolName).matchAll(/"jobId":"([^"\\]+)"/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

/** The proposal id in the newest propose_memo_change result, or null. */
export function proposalIdIn(prompt: LanguageModelV4Prompt): string | null {
  return new RegExp(`"proposalId":"(${UUID})"`).exec(lastToolOutput(prompt, "propose_memo_change"))?.[1] ?? null;
}

/** A text-only reply that ends the turn. */
export function say(text: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage, providerMetadata: billed },
  ];
}

/** A step that calls tools (in parallel when there are several); ids come from `nextId`. */
export function toolCalls(nextId: () => string, calls: Array<readonly [string, unknown]>): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    ...calls.map(
      ([toolName, input]): LanguageModelV4StreamPart => ({
        type: "tool-call",
        toolCallId: nextId(),
        toolName,
        input: JSON.stringify(input),
      }),
    ),
    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, providerMetadata: billed },
  ];
}

const COMPARISON_ROWS = ["requirements", "pay", "arrangement", "red_flags", "age", "unknowns"] as const;

/** The scripted turns of one golden scenario for one persona. */
export function gateScript(id: ScenarioId, persona: Persona): GateScript {
  const errors: string[] = [];
  let seq = 0;
  const nextId = () => `call-${id}-${++seq}`;
  const call = (...calls: Array<readonly [string, unknown]>) => toolCalls(nextId, calls);
  const present = (payload: Record<string, unknown>) => call(["present", { payload: { variant: 1, ...payload } }]);
  /** A MemoDiff surface for the proposal just created, or a plain reply naming the miss. */
  const presentProposal = (title: string, note: string): ScriptStep => (prompt) => {
    const proposalId = proposalIdIn(prompt);
    if (proposalId === null) {
      errors.push(`${id}: no proposal id in the propose_memo_change result`);
      return say("I could not draft that change.");
    }
    return present({
      title,
      blocks: [
        { type: "MemoDiff", proposalId },
        { type: "Callout", tone: "info", text: note },
      ],
    });
  };
  const [first, second] = persona.jobs;

  switch (id) {
    case "a_resume_upload": {
      let picked: string[] = [];
      return {
        errors,
        turns: [
          // The message with the résumé attached: read it, then ask to make it the résumé.
          [
            () => call(["read_document", { documentId: persona.documentId }]),
            () => call(["set_resume", { documentId: persona.documentId }]),
          ],
          // After the approval: the readback and the intake questions.
          [
            () => call(["get_profile_summary", {}]),
            () =>
              present({
                title: "Your profile",
                blocks: [
                  { type: "ProfileReadback", note: "Read from the résumé you uploaded." },
                  {
                    type: "IntakeQuestions",
                    questions: [
                      { id: "locations", label: "Where would you like to work?", kind: "locations" },
                      { id: "arrangement", label: "Remote, hybrid or on site?", kind: "multi", options: ["Remote", "Hybrid", "On site"] },
                      { id: "avoid", label: "Anything you want to avoid?", kind: "text" },
                    ],
                  },
                ],
              }),
            () => say("Here is what I read. A few questions so I know what to look for."),
          ],
          // The answers: a memo proposal on a diff card.
          [
            () => call(["get_memo", {}]),
            () => call(["propose_memo_change", { proposedDoc: persona.memo, rationale: "From your answers to the intake questions." }]),
            presentProposal("Your memo", "Nothing changes until you approve it."),
            () => say("I drafted what you are looking for. Approve it when it reads right."),
          ],
          // After the memo is approved: suggest the three best fits.
          [
            () => call(["search_jobs", { sort: "fit", limit: 10 }]),
            (prompt) => {
              picked = jobIdsIn(prompt, "search_jobs").slice(0, 3);
              if (picked.length === 0) {
                errors.push(`${id}: search_jobs found no jobs`);
                return say("I found nothing to suggest yet.");
              }
              return call(...picked.map((jobId) => ["set_shortlist_state", { jobId, state: "suggested" }] as const));
            },
            () =>
              present({
                title: "Your first shortlist",
                blocks: [
                  { type: "ShortlistQueue", jobIds: picked },
                  { type: "Callout", tone: "info", text: "I suggested your best fits. Keep, park or skip each one." },
                ],
              }),
            () => say("Your first shortlist is ready."),
          ],
        ],
      };
    }
    case "b_compare":
      return {
        errors,
        turns: [
          // The compare message: read both jobs and reviews, then compare them.
          [
            () =>
              call(
                ["get_job", { jobId: first.jobId }],
                ["get_job", { jobId: second.jobId }],
                ["get_review", { jobId: first.jobId }],
                ["get_review", { jobId: second.jobId }],
                ["get_memo", {}],
              ),
            () =>
              present({
                title: "Two roles side by side",
                blocks: [
                  {
                    type: "JobComparison",
                    jobIds: [first.jobId, second.jobId],
                    rowOrder: [...COMPARISON_ROWS],
                    verdict: "Both fit you well; they differ most on where you would work.",
                  },
                ],
              }),
            () => say("Here they are side by side."),
          ],
          // The preference: a proposal the user does not approve, so the memo stays as it is.
          [
            () => call(["get_memo", {}]),
            () =>
              call([
                "propose_memo_change",
                {
                  proposedDoc: { ...persona.memo, compensation: `${persona.memo.compensation} Remote matters more than pay.` },
                  rationale: "You said remote matters more to you than pay.",
                },
              ]),
            presentProposal("Remote first", "Your memo stays as it is until you approve this change."),
            () => say("I drafted that change for you to approve."),
          ],
        ],
      };
    case "c_prep": {
      let best = first.jobId;
      const job = () => persona.jobs.find((j) => j.jobId === best) ?? first;
      return {
        errors,
        turns: [
          // The ask: find the best fit, read its review, then ask to prepare it.
          [
            () => call(["search_jobs", { sort: "fit", limit: 1 }]),
            (prompt) => {
              const found = jobIdsIn(prompt, "search_jobs")[0];
              if (found === undefined) errors.push(`${id}: search_jobs found no jobs`);
              else best = found;
              return call(["get_review", { jobId: best }]);
            },
            () => call(["start_application_prep", { jobId: best }]),
          ],
          // After the approval: the checklist, the evidence for each requirement and the résumé.
          [
            () => call(["get_job", { jobId: best }], ["get_review", { jobId: best }]),
            () =>
              present({
                title: "Your application",
                blocks: [
                  { type: "PrepChecklist", jobId: best },
                  {
                    type: "EvidenceMap",
                    jobId: best,
                    rows: job().requirements.map((r, requirementIndex) => ({
                      requirementIndex,
                      evidence: r.met ? "Shown in your résumé." : "Not shown in your résumé yet.",
                      gap: !r.met,
                    })),
                  },
                  { type: "DocumentPreview", jobId: best, doc: "resume" },
                ],
              }),
            () => say("Your application is prepared. Check the tailored résumé before you send it."),
          ],
        ],
      };
    }
    case "d_weekly":
      return {
        errors,
        turns: [
          // One step per metric, so the metricRefs (the order they were read) are fixed.
          [
            () => call(["query_metrics", { metric: "applications_by_stage", groupBy: "stage", window: "30d" }]),
            () => call(["query_metrics", { metric: "response_rate", window: "30d" }]),
            () => call(["query_metrics", { metric: "applications_over_time", groupBy: "week", window: "30d" }]),
            () => call(["list_applications", {}]),
            () =>
              present({
                title: "Your last few weeks",
                blocks: [
                  { type: "StatRow", metricRefs: [1, 0] },
                  { type: "MetricChart", metricRef: 2, viz: "bar", title: "Applications sent per week" },
                  { type: "StaleList", limit: 5 },
                ],
              }),
            () => say("Here is how your search went. The quiet ones are worth a follow-up."),
          ],
        ],
      };
  }
}
