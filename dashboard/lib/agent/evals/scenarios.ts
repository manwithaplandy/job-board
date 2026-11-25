// The four golden scenarios (plan Task 1.22, spec 5(a) to 5(d)): what the user says,
// presses and approves, in order. The live harness (harness.ts) plays them against a
// real model and the phase 1 gate (phase1.db.test.ts) against a scripted one; both seed
// the persona with the scenario's setup first (personas.ts).
//
// Pure: data only. Jobs are named by their index in the persona's job list, so one
// scenario runs for every persona.
import type { ApprovalToolName } from "@/lib/agent/tools/approval";

export const SCENARIO_IDS = ["a_resume_upload", "b_compare", "c_prep", "d_weekly"] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/** What seedPersona writes besides the catalog jobs and their reviews. */
export interface PersonaSetup {
  /** on_profile: the résumé is already the profile's; uploaded: the profile has none yet and the file is an uploaded document. */
  resume: "on_profile" | "uploaded";
  /** A "What I'm looking for" memo at version 1. */
  memo: boolean;
  /** Six tracked applications over the last three weeks (two with interviews, one stale). */
  applications: boolean;
}

export type ScenarioStep =
  /** A chat message; attachResume attaches the uploaded résumé document. */
  | { kind: "message"; text: string; attachResume?: boolean }
  /** The compare intent's message for two of the persona's jobs (by index), as ?compare=a,b sends it. */
  | { kind: "compare"; jobs: [number, number] }
  /** The user's answer to the pending approval of `tool`. */
  | { kind: "approve"; tool: ApprovalToolName; approved: boolean }
  /** A press on the newest MemoDiff surface: approve or decline its proposal in place (memo.resolve). */
  | { kind: "memo_resolve"; decision: "approve" | "decline" };

export interface Scenario {
  id: ScenarioId;
  /** One line for the cost table. */
  title: string;
  setup: PersonaSetup;
  steps: ScenarioStep[];
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  // 5(a): a new user uploads a résumé and approves making it their résumé, sees the
  // readback and intake questions, answers them, approves the memo the agent drafts,
  // and ends with a suggested shortlist.
  a_resume_upload: {
    id: "a_resume_upload",
    title: "Résumé upload to first shortlist",
    setup: { resume: "uploaded", memo: false, applications: false },
    steps: [
      { kind: "message", text: "Here is my résumé. Please use it and get me set up.", attachResume: true },
      { kind: "approve", tool: "set_resume", approved: true },
      {
        kind: "message",
        text: "Remote or my preferred cities are fine. I want product-minded teams and a fair salary, no gambling or crypto companies.",
      },
      { kind: "memo_resolve", decision: "approve" },
      { kind: "message", text: "Thanks. Now find me a first shortlist." },
    ],
  },
  // 5(b): compare two jobs, then a preference that should become a memo proposal the
  // user has not approved (so the memo must not change).
  b_compare: {
    id: "b_compare",
    title: "Compare two jobs",
    setup: { resume: "on_profile", memo: true, applications: false },
    steps: [
      { kind: "compare", jobs: [0, 1] },
      { kind: "message", text: "Remote matters more to me than pay. Can you note that in what I'm looking for?" },
    ],
  },
  // 5(c): prepare an application (an approval tool), then show the checklist, the
  // evidence for each requirement and the tailored résumé.
  c_prep: {
    id: "c_prep",
    title: "Prepare an application",
    setup: { resume: "on_profile", memo: true, applications: false },
    steps: [
      { kind: "message", text: "Please prepare my application for my best-fitting job." },
      { kind: "approve", tool: "start_application_prep", approved: true },
    ],
  },
  // 5(d): the weekly review: counts, the response rate with its n, activity over time and
  // the applications that went quiet.
  d_weekly: {
    id: "d_weekly",
    title: "Weekly review",
    setup: { resume: "on_profile", memo: true, applications: true },
    steps: [{ kind: "message", text: "How did my search go over the last few weeks? What should I follow up on?" }],
  },
};
