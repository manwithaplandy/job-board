import { beforeEach, describe, expect, test, vi } from "vitest";

// The database is a fake keyed by SQL text: at most one application for the job, whether
// the caller has a review, and the events and audit rows written. Every statement is
// recorded with the wrapper it ran under. The applied core (package writes) is mocked:
// it records the call and runs `also` in its own transaction.
type App = { id: string; stage: string; closed_reason: string | null };
const db = vi.hoisted(() => ({
  app: null as App | null,
  reviewed: true,
  calls: [] as { wrapper: string; text: string; values: unknown[] }[],
  events: [] as { kind: string; from: unknown; to: unknown; note: unknown; actor: unknown }[],
  core: [] as string[],
  nextEventId: 1,
  nextActionId: 1,
}));

const JOB = "lever:acme:1";
const APP = "44444444-4444-4444-8444-444444444444";

function fakeTx(wrapper: string) {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    db.calls.push({ wrapper, text, values });
    if (text.includes("SELECT id, stage, closed_reason FROM applications")) {
      return Promise.resolve(db.app ? [{ ...db.app }] : []);
    }
    if (text.includes("SELECT EXISTS")) return Promise.resolve([{ reviewed: db.reviewed }]);
    if (text.includes("INSERT INTO applications")) {
      db.app = { id: APP, stage: values[2] as string, closed_reason: values[3] as string | null };
      return Promise.resolve([{ id: APP }]);
    }
    if (text.includes("UPDATE applications SET stage")) {
      if (db.app) db.app = { ...db.app, stage: values[0] as string, closed_reason: values[1] as string | null };
      return Promise.resolve([]);
    }
    if (text.includes("UPDATE applications SET next_step_on")) return Promise.resolve(db.app ? [{ id: APP }] : []);
    if (text.includes("INSERT INTO application_events")) {
      const note = text.includes("'note'");
      db.events.push(
        note
          ? { kind: "note", from: null, to: null, note: values[2], actor: values[3] }
          : { kind: "stage", from: values[2], to: values[3], note: null, actor: values[4] },
      );
      return Promise.resolve([{ id: String(db.nextEventId++) }]);
    }
    if (text.includes("agent_log_action")) return Promise.resolve([{ id: String(db.nextActionId++) }]);
    return Promise.resolve([]);
  };
}

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserSql"))),
  withUserMutation: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserMutation"))),
}));
vi.mock("@/lib/workspaces/appliedCore", () => ({
  markAppliedCore: vi.fn(async (_u: string, _j: string, also?: (t: unknown) => Promise<void>) => {
    db.core.push("mark");
    if (also) await also(fakeTx("payload"));
  }),
  unmarkAppliedCore: vi.fn(async (_u: string, _j: string, also?: (t: unknown) => Promise<void>) => {
    db.core.push("unmark");
    if (also) await also(fakeTx("withUserMutation"));
  }),
  unmarkAppliedTx: vi.fn(async () => {
    db.core.push("unmarkTx");
  }),
}));
vi.mock("@/lib/catalogClock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogClock")>()),
  catalogNow: vi.fn(async () => ({ now: new Date("2026-11-11T00:00:00Z"), frozen: true })),
}));

import { emptyGathered } from "@/lib/agent/gathered";
import type { ToolCtx } from "@/lib/agent/tools";
import {
  addApplicationNote,
  ApplicationInputError,
  NOTE_MAX,
  NotReviewedError,
  setApplicationStage,
  setNextStep,
  NotTrackedError,
} from "@/lib/workspaces/applications";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ctx = (extra: Partial<ToolCtx> = {}): ToolCtx => ({
  userId: USER,
  email: null,
  threadId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  variant: 1,
  unattended: false,
  gathered: emptyGathered(),
  repairsLeft: { n: 1 }, views: { used: 0 },
  ...extra,
});
const audits = () => db.calls.filter((c) => c.text.includes("agent_log_action"));
const writes = () => db.calls.filter((c) => /INSERT INTO|UPDATE \w+ SET|DELETE FROM/.test(c.text));

beforeEach(() => {
  db.app = null;
  db.reviewed = true;
  db.calls = [];
  db.events = [];
  db.core = [];
  db.nextEventId = 1;
  db.nextActionId = 1;
});

describe("setApplicationStage", () => {
  test("closed without a reason throws; a reason on another stage throws", async () => {
    await expect(setApplicationStage(USER, { jobId: JOB, stage: "closed", actor: "user" })).rejects.toThrow(
      ApplicationInputError,
    );
    await expect(
      setApplicationStage(USER, { jobId: JOB, stage: "interviewing", closedReason: "rejected", actor: "user" }),
    ).rejects.toThrow(ApplicationInputError);
    await expect(
      setApplicationStage(USER, { jobId: JOB, stage: "nonsense" as never, actor: "user" }),
    ).rejects.toThrow(ApplicationInputError);
    expect(db.calls).toHaveLength(0);
  });

  test("every stage change appends one stage event with from and to", async () => {
    await setApplicationStage(USER, { jobId: JOB, stage: "preparing", actor: "user" });
    await setApplicationStage(USER, { jobId: JOB, stage: "interviewing", actor: "user" });
    await setApplicationStage(USER, { jobId: JOB, stage: "closed", closedReason: "rejected", actor: "agent", audit: ctx() });
    expect(db.events).toEqual([
      { kind: "stage", from: null, to: "preparing", note: null, actor: "user" },
      { kind: "stage", from: "preparing", to: "interviewing", note: null, actor: "user" },
      { kind: "stage", from: "interviewing", to: "closed", note: null, actor: "agent" },
    ]);
    expect(db.app).toEqual({ id: APP, stage: "closed", closed_reason: "rejected" });
    // Stage writes other than applied run under the lifecycle gate.
    expect(db.calls.filter((c) => c.text.includes("UPDATE applications SET stage")).every((c) => c.wrapper === "withUserMutation")).toBe(true);
  });

  test("a move to the stage the row already has writes no event and no audit row", async () => {
    db.app = { id: APP, stage: "interviewing", closed_reason: null };
    expect(await setApplicationStage(USER, { jobId: JOB, stage: "interviewing", actor: "agent", audit: ctx() })).toEqual({
      actionId: null,
    });
    expect(db.events).toHaveLength(0);
    expect(audits()).toHaveLength(0);
  });

  test("moving to applied marks the package applied when one exists and is fine when none exists", async () => {
    db.app = { id: APP, stage: "ready", closed_reason: null };
    await setApplicationStage(USER, { jobId: JOB, stage: "applied", actor: "user" });
    expect(db.core).toEqual(["mark"]);
    // The stage write ran inside the package transaction.
    expect(db.calls.find((c) => c.text.includes("UPDATE applications SET stage"))?.wrapper).toBe("payload");
    expect(db.events).toEqual([{ kind: "stage", from: "ready", to: "applied", note: null, actor: "user" }]);

    db.app = null;
    db.events = [];
    db.core = [];
    await setApplicationStage(USER, { jobId: JOB, stage: "applied", actor: "user" });
    expect(db.core).toEqual(["mark"]);
    expect(db.events).toEqual([{ kind: "stage", from: null, to: "applied", note: null, actor: "user" }]);
  });

  test("moving back before applied unmarks the package in the same transaction", async () => {
    db.app = { id: APP, stage: "applied", closed_reason: null };
    await setApplicationStage(USER, { jobId: JOB, stage: "ready", actor: "user" });
    expect(db.core).toEqual(["unmark"]);
    db.core = [];
    await setApplicationStage(USER, { jobId: JOB, stage: "interviewing", actor: "user" });
    expect(db.core).toEqual([]);
  });

  test("a job with no review for the user cannot be tracked", async () => {
    db.reviewed = false;
    await expect(setApplicationStage(USER, { jobId: JOB, stage: "applied", actor: "user" })).rejects.toThrow(
      NotReviewedError,
    );
    await expect(addApplicationNote(USER, { jobId: JOB, note: "Called the recruiter", actor: "user" })).rejects.toThrow(
      NotReviewedError,
    );
    expect(db.core).toEqual([]);
    expect(writes()).toHaveLength(0);
  });

  test("with audit set, the action row holds before and after; a user move through the agent page is user_via_surface", async () => {
    db.app = { id: APP, stage: "applied", closed_reason: null };
    const out = await setApplicationStage(USER, { jobId: JOB, stage: "interviewing", actor: "agent", audit: ctx() });
    expect(out).toEqual({ actionId: 1 });
    const [log] = audits();
    expect(log.values.slice(2)).toEqual([
      "agent",
      "application.set_stage",
      JSON.stringify({ jobId: JOB }),
      JSON.stringify({ stage: "applied", closedReason: null }),
      JSON.stringify({ stage: "interviewing", closedReason: null }),
    ]);
    await setApplicationStage(USER, { jobId: JOB, stage: "offer", actor: "user", audit: ctx() });
    expect(audits()[1].values[2]).toBe("user_via_surface");
  });

  test("an unattended run may not change a tracker stage", async () => {
    await expect(
      setApplicationStage(USER, { jobId: JOB, stage: "interviewing", actor: "agent", audit: ctx({ unattended: true }) }),
    ).rejects.toThrow(ApplicationInputError);
    expect(db.calls).toHaveLength(0);
  });
});

describe("addApplicationNote", () => {
  test("a note longer than 2000 chars is rejected", async () => {
    await expect(addApplicationNote(USER, { jobId: JOB, note: "x".repeat(NOTE_MAX + 1), actor: "user" })).rejects.toThrow(
      ApplicationInputError,
    );
    await expect(addApplicationNote(USER, { jobId: JOB, note: "   ", actor: "user" })).rejects.toThrow(ApplicationInputError);
    expect(db.calls).toHaveLength(0);
    // Exactly the cap, counted in characters (an emoji is one), is accepted.
    db.app = { id: APP, stage: "applied", closed_reason: null };
    await addApplicationNote(USER, { jobId: JOB, note: "\u{1F600}".repeat(NOTE_MAX), actor: "user" });
    expect(db.events).toHaveLength(1);
  });

  test("a note on an untracked, reviewed job starts the application at preparing", async () => {
    const out = await addApplicationNote(USER, { jobId: JOB, note: " Called the recruiter ", actor: "agent", audit: ctx() });
    expect(db.events).toEqual([
      { kind: "stage", from: null, to: "preparing", note: null, actor: "agent" },
      { kind: "note", from: null, to: null, note: "Called the recruiter", actor: "agent" },
    ]);
    expect(out).toEqual({ eventId: 2, actionId: 1 });
    expect(audits()[0].values.slice(3)).toEqual([
      "application.add_note",
      JSON.stringify({ jobId: JOB, eventId: 2 }),
      null,
      JSON.stringify({ eventId: 2, note: "Called the recruiter" }),
    ]);
  });
});

describe("setNextStep", () => {
  test("accepts a calendar date or null and refuses anything else before any SQL", async () => {
    db.app = { id: APP, stage: "applied", closed_reason: null };
    await setNextStep(USER, JOB, "2026-12-01");
    await setNextStep(USER, JOB, null);
    expect(db.calls.filter((c) => c.text.includes("next_step_on")).map((c) => c.values[0])).toEqual(["2026-12-01", null]);
    db.calls = [];
    await expect(setNextStep(USER, JOB, "2026-02-30")).rejects.toThrow(ApplicationInputError);
    await expect(setNextStep(USER, JOB, "tomorrow")).rejects.toThrow(ApplicationInputError);
    expect(db.calls).toHaveLength(0);
  });

  test("an untracked job is refused", async () => {
    await expect(setNextStep(USER, JOB, "2026-12-01")).rejects.toThrow(NotTrackedError);
  });
});
