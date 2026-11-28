import { beforeEach, describe, expect, test, vi } from "vitest";

// The database is a fake keyed by SQL text: one shortlist row for the job, whether the
// caller has a review, and a log of sticky-deny and audit statements. Every statement
// is recorded with the wrapper it ran under.
type Row = { state: string; reason_code: string | null; reason_text: string | null; set_by: string };
const db = vi.hoisted(() => ({
  row: null as Row | null,
  reviewed: true,
  overridden: false,
  calls: [] as { wrapper: string; text: string; values: unknown[] }[],
  nextActionId: 1,
}));

const JOB = "lever:acme:1";
const created = new Date("2026-11-01T00:00:00Z");

function fakeTx(wrapper: string) {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    db.calls.push({ wrapper, text, values });
    if (text.includes("FROM shortlist_items s")) {
      if (!db.row) return Promise.resolve([]);
      return Promise.resolve([{
        ...db.row, brief_why: null, brief_risk: null, updated_at: created,
        j_id: JOB, j_title: "Engineer", j_company: "Acme", j_location: null, j_remote: true,
        j_url: "https://example.test/1", j_first_seen_at: created, j_closed: false, fit_score: 80,
      }]);
    }
    if (text.includes("SELECT EXISTS") && text.includes("human_override")) {
      return Promise.resolve([{ overridden: db.overridden }]);
    }
    if (text.includes("SELECT EXISTS")) return Promise.resolve([{ reviewed: db.reviewed }]);
    if (text.includes("INSERT INTO shortlist_items")) {
      db.row = { state: values[2] as string, reason_code: values[3] as string | null,
        reason_text: values[4] as string | null, set_by: values[5] as string };
      return Promise.resolve([]);
    }
    if (text.includes("DELETE FROM shortlist_items")) {
      db.row = null;
      return Promise.resolve([]);
    }
    if (text.includes("agent_log_action")) return Promise.resolve([{ id: String(db.nextActionId++) }]);
    return Promise.resolve([]);
  };
}

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserSql"))),
  withUserMutation: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserMutation"))),
}));
vi.mock("@/lib/catalogClock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogClock")>()),
  catalogNow: vi.fn(async () => ({ now: new Date("2026-11-11T00:00:00Z"), frozen: true })),
}));

import { emptyGathered } from "@/lib/agent/gathered";
import type { ToolCtx } from "@/lib/agent/tools";
import { boardClosedPredicateSql } from "@/lib/jobsQuery";
import { JOB_CLOSED_PREDICATE } from "@/lib/workspaces/jobFacts";
import {
  AGENT_SKIP_REASONS,
  listShortlist,
  NotReviewedError,
  setShortlistState,
  ShortlistInputError,
  USER_SKIP_REASONS,
} from "@/lib/workspaces/shortlist";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ctx = (extra: Partial<ToolCtx> = {}): ToolCtx => ({
  userId: USER,
  email: null,
  threadId: "22222222-2222-4222-8222-222222222222",
  runId: "33333333-3333-4333-8333-333333333333",
  variant: 1,
  unattended: false,
  gathered: emptyGathered(),
  repairsLeft: { n: 1 }, views: { used: 0 }, fromView: false,
  ...extra,
});

const denies = () => db.calls.filter((c) => c.text.includes("INSERT INTO job_reviews"));
const undenies = () => db.calls.filter((c) => c.text.includes("UPDATE job_reviews"));
const audits = () => db.calls.filter((c) => c.text.includes("agent_log_action"));

beforeEach(() => {
  db.row = null;
  db.reviewed = true;
  db.overridden = false;
  db.calls = [];
  db.nextActionId = 1;
});

describe("setShortlistState", () => {
  test("a skip without a reason code throws before any SQL", async () => {
    await expect(setShortlistState(USER, { jobId: JOB, state: "skipped", setBy: "user" })).rejects.toThrow(
      ShortlistInputError,
    );
    expect(db.calls).toHaveLength(0);
  });

  test("a user skip writes the sticky deny; an agent skip does not", async () => {
    await setShortlistState(USER, { jobId: JOB, state: "skipped", reasonCode: "pay", setBy: "user" });
    expect(denies()).toHaveLength(1);
    expect(denies()[0].values).toEqual([USER, JOB]);
    expect(denies()[0].wrapper).toBe("withUserMutation");

    db.row = null;
    db.calls = [];
    await setShortlistState(USER, { jobId: JOB, state: "skipped", reasonCode: "red_flag", setBy: "agent" });
    expect(denies()).toHaveLength(0);
    expect(db.row).toEqual({ state: "skipped", reason_code: "red_flag", reason_text: null, set_by: "agent" });
  });

  test("an agent may not use a user-only reason code and vice versa", async () => {
    for (const code of USER_SKIP_REASONS) {
      await expect(
        setShortlistState(USER, { jobId: JOB, state: "skipped", reasonCode: code, setBy: "agent" }),
      ).rejects.toThrow(ShortlistInputError);
    }
    for (const code of AGENT_SKIP_REASONS) {
      await expect(
        setShortlistState(USER, { jobId: JOB, state: "skipped", reasonCode: code, setBy: "user" }),
      ).rejects.toThrow(ShortlistInputError);
    }
    await expect(
      setShortlistState(USER, { jobId: JOB, state: "skipped", reasonCode: "because", setBy: "user" }),
    ).rejects.toThrow(ShortlistInputError);
    expect(db.calls).toHaveLength(0);
  });

  test("overriding an agent skip to shortlisted is one call and leaves no deny row", async () => {
    db.row = { state: "skipped", reason_code: "deal_breaker", reason_text: null, set_by: "agent" };
    const out = await setShortlistState(USER, { jobId: JOB, state: "shortlisted", setBy: "user" });
    expect(out).toMatchObject({ after: { state: "shortlisted", setBy: "user", reasonCode: null } });
    expect(denies()).toHaveLength(0);
    expect(undenies()).toHaveLength(0);
  });

  test("leaving a user skip clears the sticky deny back to unreviewed", async () => {
    db.row = { state: "skipped", reason_code: "pay", reason_text: "too low", set_by: "user" };
    await setShortlistState(USER, { jobId: JOB, state: "later", setBy: "user" });
    expect(undenies()).toHaveLength(1);
    expect(undenies()[0].values.slice(0, 1)).toEqual([null]);
    expect(undenies()[0].text).toContain("human_override = TRUE");
  });

  test("the job must have a review for this user", async () => {
    db.reviewed = false;
    await expect(setShortlistState(USER, { jobId: JOB, state: "shortlisted", setBy: "user" })).rejects.toThrow(
      NotReviewedError,
    );
    expect(db.calls.some((c) => c.text.includes("INSERT INTO shortlist_items"))).toBe(false);
    await expect(setShortlistState(USER, { jobId: "not a job id", state: "later", setBy: "user" })).rejects.toThrow(
      ShortlistInputError,
    );
  });

  test("with audit set, the action row holds before and after", async () => {
    db.row = { state: "suggested", reason_code: null, reason_text: null, set_by: "system" };
    const out = await setShortlistState(USER, { jobId: JOB, state: "shortlisted", setBy: "agent", audit: ctx() });
    expect(out).toMatchObject({ actionId: 1 });
    expect(audits()).toHaveLength(1);
    const values = audits()[0].values;
    expect(values.slice(0, 4)).toEqual([ctx().runId, ctx().threadId, "agent", "shortlist.set"]);
    expect(JSON.parse(values[4] as string)).toEqual({ jobId: JOB });
    expect(JSON.parse(values[5] as string)).toEqual({
      state: "suggested", reasonCode: null, reasonText: null, setBy: "system",
    });
    expect(JSON.parse(values[6] as string)).toEqual({
      state: "shortlisted", reasonCode: null, reasonText: null, setBy: "agent",
    });
    // Without audit there is no action row.
    db.calls = [];
    expect(await setShortlistState(USER, { jobId: JOB, state: "later", setBy: "user" })).toMatchObject({
      actionId: null,
    });
    expect(audits()).toHaveLength(0);
  });

  test("an unattended write over a user-set row changes nothing and returns user_owned", async () => {
    db.row = { state: "later", reason_code: null, reason_text: null, set_by: "user" };
    const out = await setShortlistState(USER, {
      jobId: JOB, state: "skipped", reasonCode: "posting_age", setBy: "agent", audit: ctx({ unattended: true }),
    });
    expect(out).toEqual({ skipped: "user_owned" });
    expect(db.row).toEqual({ state: "later", reason_code: null, reason_text: null, set_by: "user" });
    expect(db.calls.some((c) => c.text.includes("INSERT INTO shortlist_items"))).toBe(false);
    expect(audits()).toHaveLength(0);
  });

  test("an unattended write over a system or agent row succeeds", async () => {
    for (const setBy of ["system", "agent"]) {
      db.row = { state: "suggested", reason_code: null, reason_text: null, set_by: setBy };
      db.calls = [];
      const out = await setShortlistState(USER, {
        jobId: JOB, state: "skipped", reasonCode: "missing_pay", setBy: "agent", audit: ctx({ unattended: true }),
      });
      expect(out).toMatchObject({ after: { state: "skipped", reasonCode: "missing_pay", setBy: "agent" } });
      expect(audits()[0].values[2]).toBe("agent_unattended");
    }
    // An absent row too.
    db.row = null;
    expect(
      await setShortlistState(USER, {
        jobId: JOB, state: "later", setBy: "agent", audit: ctx({ unattended: true }),
      }),
    ).toMatchObject({ before: null, after: { state: "later" } });
  });

  test("an unattended write for a job the user rejected by hand returns user_owned; an interactive one goes ahead", async () => {
    db.overridden = true;
    for (const row of [null, { state: "suggested", reason_code: null, reason_text: null, set_by: "agent" }]) {
      db.row = row;
      db.calls = [];
      const out = await setShortlistState(USER, {
        jobId: JOB, state: "shortlisted", setBy: "agent", audit: ctx({ unattended: true }),
      });
      expect(out).toEqual({ skipped: "user_owned" });
      expect(db.calls.some((c) => c.text.includes("INSERT INTO shortlist_items"))).toBe(false);
      expect(audits()).toHaveLength(0);
    }
    db.row = null;
    expect(await setShortlistState(USER, { jobId: JOB, state: "shortlisted", setBy: "agent", audit: ctx() }))
      .toMatchObject({ before: null, after: { state: "shortlisted" } });
  });

  test("an unattended write must be the agent's, and a reason text over 500 chars is refused", async () => {
    await expect(
      setShortlistState(USER, { jobId: JOB, state: "later", setBy: "user", audit: ctx({ unattended: true }) }),
    ).rejects.toThrow(ShortlistInputError);
    await expect(
      setShortlistState(USER, {
        jobId: JOB, state: "skipped", reasonCode: "other", reasonText: "x".repeat(501), setBy: "user",
      }),
    ).rejects.toThrow(ShortlistInputError);
    expect(db.calls).toHaveLength(0);
  });
});

describe("listShortlist", () => {
  test("reads under withUserSql with the board's closed test and catalog-clock ages", async () => {
    db.row = { state: "later", reason_code: null, reason_text: null, set_by: "user" };
    const rows = await listShortlist(USER, ["later"]);
    expect(rows).toEqual([
      expect.objectContaining({
        jobId: JOB, state: "later", fitScore: 80,
        job: expect.objectContaining({ ageDays: 10, url: "https://example.test/1", closed: false }),
      }),
    ]);
    expect(db.calls[0].wrapper).toBe("withUserSql");
    expect(db.calls[0].text).toContain(JOB_CLOSED_PREDICATE);
    expect(JOB_CLOSED_PREDICATE).toBe(boardClosedPredicateSql());
    expect(db.calls[0].values).toEqual([USER, ["later"], ["later"]]);
  });
});
