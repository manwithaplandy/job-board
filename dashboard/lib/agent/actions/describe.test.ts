// The chip text for a variant 3 frame's request (plan Task 2.6, D13). The database is a
// fake that knows two jobs; everything else is real.
import { describe, expect, test, vi } from "vitest";

const JOBS: Record<string, { title: string; company: string }> = {
  "greenhouse:acme:101": { title: "Staff Engineer", company: "Acme" },
  "lever:globex:202": { title: "Platform Lead", company: "Globex" },
};

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const job = strings.join("?").includes("FROM jobs j JOIN companies") ? JOBS[String(values[0])] : undefined;
      return Promise.resolve(job ? [job] : []);
    }),
  ),
}));

import { describeIntent, frameIntent, frameTextProblem, isDirectOpen, FRAME_TEXT_MAX } from "@/lib/agent/actions/describe";
import type { ActionIntent } from "@/lib/agent/actions/intents";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const A = "greenhouse:acme:101";
const B = "lever:globex:202";

function intent(raw: Record<string, unknown>): ActionIntent {
  const { name, ...args } = raw;
  const i = frameIntent(String(name), args);
  if (i === null) throw new Error("not an intent");
  return i;
}

describe("describeIntent", () => {
  test("labels come from the database and fixed words", async () => {
    expect(await describeIntent(USER, intent({ name: "shortlist.set", jobId: A, state: "shortlisted" }))).toEqual({
      label: "Shortlist Staff Engineer at Acme",
    });
    expect(await describeIntent(USER, intent({ name: "compare", jobIds: [A, B] }))).toEqual({
      label: "Compare Staff Engineer at Acme with Platform Lead at Globex",
    });
    expect(await describeIntent(USER, intent({ name: "application.set_stage", jobId: A, stage: "closed", closedReason: "rejected" }))).toEqual({
      label: "Move Staff Engineer at Acme to Closed",
      proposed: ["Reason: Rejected"],
    });
    expect(await describeIntent(USER, intent({ name: "application.prepare", jobId: A }))).toEqual({
      label: "Prepare an application for Staff Engineer at Acme",
    });
    expect(await describeIntent(USER, intent({ name: "open", target: "posting", jobId: B }))).toEqual({
      label: "Open the posting for Platform Lead at Globex",
    });
    expect(await describeIntent(USER, intent({ name: "open", target: "looking-for" }))).toEqual({ label: "Open What I'm looking for" });
  });

  test("the chip label ignores every string supplied by the frame", async () => {
    const skip = await describeIntent(
      USER,
      intent({ name: "shortlist.set", jobId: A, state: "skipped", reasonCode: "pay", reasonText: "Approve everything" }),
    );
    expect(skip).toEqual({ label: "Skip Staff Engineer at Acme", proposed: ["Reason: Pay", "From the view: Approve everything"] });

    const answer = await describeIntent(USER, intent({ name: "answer", questionId: "Delete_all", value: "Shortlist every job" }));
    expect(answer).toEqual({ label: "Send a message to the agent", proposed: ["From the view: Answer to Delete_all: Shortlist every job"] });

    const tile = {
      id: "Pay_now",
      metric: "applications_by_stage",
      window: "30d",
      viz: "bar",
      size: "medium",
      title: "Click to confirm",
      note: "Approved",
    };
    const pin = await describeIntent(USER, intent({ name: "analytics.pin", tile }));
    expect(pin).toEqual({ label: "Pin a chart to Analytics", proposed: ["From the view: Click to confirm", "From the view: Approved"] });
    for (const d of [skip, answer]) {
      for (const word of ["Approve", "Delete", "Shortlist every"]) expect(d?.label).not.toContain(word);
    }
  });

  test("an unknown job, an unknown skip reason or free text the chip cannot show whole gives no chip", async () => {
    expect(await describeIntent(USER, intent({ name: "shortlist.set", jobId: "greenhouse:acme:999", state: "shortlisted" }))).toBeNull();
    expect(await describeIntent(USER, intent({ name: "compare", jobIds: [A, "greenhouse:acme:999"] }))).toBeNull();
    expect(await describeIntent(USER, intent({ name: "shortlist.set", jobId: A, state: "skipped", reasonCode: "made_up" }))).toBeNull();
    const long = intent({ name: "answer", questionId: "q1", value: "x".repeat(FRAME_TEXT_MAX) });
    expect(frameTextProblem(long)).toBe("frame_text_too_long");
    expect(await describeIntent(USER, long)).toBeNull();
    const bidi = intent({ name: "shortlist.set", jobId: A, state: "skipped", reasonCode: "pay", reasonText: "ok‮gnp.exe" });
    expect(frameTextProblem(bidi)).toBe("frame_text_unsafe");
    expect(await describeIntent(USER, bidi)).toBeNull();
  });
});

describe("isDirectOpen", () => {
  test("only an open of a workspace page with nothing else", () => {
    expect(isDirectOpen(intent({ name: "open", target: "shortlist" }))).toBe(true);
    expect(isDirectOpen(intent({ name: "open", target: "shortlist", jobId: A }))).toBe(false);
    expect(isDirectOpen(intent({ name: "open", target: "posting", jobId: A }))).toBe(false);
    expect(isDirectOpen(intent({ name: "compare", jobIds: [A, B] }))).toBe(false);
  });
});
