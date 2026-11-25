// validateSurface for variant 1 (plan Task 1.17): the strict grammar, then every id must
// resolve to data gathered this turn (or a pending proposal of the user's). The proposal
// lookup is faked; everything else is real.
import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ pending: new Set<string>(), queries: 0 }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (tx: unknown) => unknown) =>
    fn((_s: TemplateStringsArray, ...values: unknown[]) => {
      m.queries += 1;
      return Promise.resolve(m.pending.has(String(values[0])) ? [{ ok: 1 }] : []);
    }),
  ),
}));

import { emptyGathered } from "@/lib/agent/gathered";
import { validateSurface } from "@/lib/agent/surfaces/v1/validate";
import { gatheredFixture, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPOSAL = "66666666-6666-4666-8666-666666666666";
const ctx = (gathered = gatheredFixture()) => ({ userId: USER, gathered });
const v1 = (blocks: unknown[], extra: Record<string, unknown> = {}) => ({ variant: 1, blocks, ...extra });

beforeEach(() => {
  m.pending = new Set();
  m.queries = 0;
});

async function errorsOf(payload: unknown, gathered = gatheredFixture()): Promise<string[]> {
  const out = await validateSurface(payload, 1, ctx(gathered));
  return out.ok ? [] : out.errors;
}

describe("validateSurface (variant 1)", () => {
  test("a payload whose ids were all gathered passes, unchanged", async () => {
    const payload = v1(
      [
        { type: "Callout", tone: "info", text: "Two strong matches." },
        { type: "JobCard", jobId: JOB_A, note: "Best fit." },
        { type: "EvidenceMap", jobId: JOB_A, rows: [{ requirementIndex: 1, evidence: "Led the platform team.", gap: false }] },
        { type: "StatRow", metricRefs: [0, 1] },
        { type: "MetricChart", metricRef: 1, viz: "line", title: "Applications" },
        { type: "IntakeQuestions", questions: [{ id: "floor", label: "Pay floor?", kind: "text" }] },
      ],
      { title: "Your shortlist" },
    );
    expect(await validateSurface(payload, 1, ctx())).toEqual({ ok: true, payload });
  });

  test("a jobId that was not gathered this turn fails validation", async () => {
    const unknown = "greenhouse:acme:999";
    expect(await errorsOf(v1([{ type: "JobCard", jobId: unknown }]))).toEqual([`blocks.0.jobId: job ${unknown} was not read this turn`]);
    expect(await errorsOf(v1([{ type: "ShortlistQueue", jobIds: [JOB_A, unknown] }]))).toHaveLength(1);
    expect(await errorsOf(v1([{ type: "PrepChecklist", jobId: JOB_A }]), emptyGathered())).toHaveLength(1);
    // A review that was not read, or a requirement it does not have, fails too.
    expect(await errorsOf(v1([{ type: "EvidenceMap", jobId: JOB_B, rows: [{ requirementIndex: 0, evidence: "x", gap: true }] }]))).toEqual([
      `blocks.0.jobId: no review of ${JOB_B} was read this turn`,
    ]);
    expect(await errorsOf(v1([{ type: "EvidenceMap", jobId: JOB_A, rows: [{ requirementIndex: 2, evidence: "x", gap: true }] }]))).toEqual([
      "blocks.0.rows.0.requirementIndex: the review has no requirement 2",
    ]);
    // So do a metric ref past the metrics read and a viz that cannot draw its metric.
    expect(await errorsOf(v1([{ type: "StatRow", metricRefs: [2] }]))).toEqual(["blocks.0.metricRefs.0: no metric 2 was read this turn"]);
    expect(await errorsOf(v1([{ type: "MetricChart", metricRef: 0, viz: "line", title: "Rate" }]))).toEqual([
      "blocks.0.viz: line cannot draw a value metric",
    ]);
  });

  test("a MemoDiff needs one of the user's pending proposals", async () => {
    expect(await errorsOf(v1([{ type: "MemoDiff", proposalId: PROPOSAL }]))).toEqual([`blocks.0.proposalId: no pending memo proposal ${PROPOSAL}`]);
    m.pending.add(PROPOSAL);
    expect(await errorsOf(v1([{ type: "MemoDiff", proposalId: PROPOSAL }]))).toEqual([]);
    expect(m.queries).toBe(2);
  });

  test("a block type outside the 13 fails", async () => {
    for (const type of ["Html", "Link", "Image", "jobcard", "Markdown"]) {
      expect((await errorsOf(v1([{ type, jobId: JOB_A }]))).length).toBeGreaterThan(0);
    }
    // An unknown key on a known block fails too (every block is strict).
    expect((await errorsOf(v1([{ type: "JobCard", jobId: JOB_A, href: "https://evil.example" }]))).length).toBeGreaterThan(0);
    expect((await errorsOf({ variant: 2, blocks: [{ type: "JobCard", jobId: JOB_A }] })).length).toBeGreaterThan(0);
  });

  test("text over its cap fails; a 9th block fails", async () => {
    const callout = (text: string) => ({ type: "Callout", tone: "info", text });
    expect(await errorsOf(v1([callout("x".repeat(400))]))).toEqual([]);
    expect((await errorsOf(v1([callout("x".repeat(401))]))).length).toBeGreaterThan(0);
    expect((await errorsOf(v1([callout("   ")]))).length).toBeGreaterThan(0);
    expect((await errorsOf(v1([{ type: "JobCard", jobId: JOB_A, note: "n".repeat(201) }]))).length).toBeGreaterThan(0);
    expect((await errorsOf(v1([callout("ok")], { title: "t".repeat(81) }))).length).toBeGreaterThan(0);
    const eight = Array.from({ length: 8 }, () => callout("ok"));
    expect(await errorsOf(v1(eight))).toEqual([]);
    expect((await errorsOf(v1([...eight, callout("ok")]))).length).toBeGreaterThan(0);
    expect((await errorsOf(v1([]))).length).toBeGreaterThan(0);
  });

  test("IntakeQuestions with duplicate options fails, so present renders the fallback", async () => {
    const intake = (options: string[]) => v1([{ type: "IntakeQuestions", questions: [{ id: "level", label: "Level?", kind: "choice", options }] }]);
    expect(await errorsOf(intake(["Senior", "Staff"]))).toEqual([]);
    expect(await errorsOf(intake(["Senior", "Staff", "Senior"]))).toEqual(["blocks.0.questions.0.options: options must be unique"]);
  });

  test("JobComparison needs exactly two distinct job ids", async () => {
    const cmp = (jobIds: unknown) => v1([{ type: "JobComparison", jobIds, rowOrder: ["pay", "requirements"], verdict: "A pays more." }]);
    expect(await errorsOf(cmp([JOB_A, JOB_B]))).toEqual([]);
    expect((await errorsOf(cmp([JOB_A, JOB_A]))).length).toBeGreaterThan(0);
    expect((await errorsOf(cmp([JOB_A]))).length).toBeGreaterThan(0);
    expect((await errorsOf(cmp([JOB_A, JOB_B, "greenhouse:acme:3"]))).length).toBeGreaterThan(0);
    const repeatedRow = v1([{ type: "JobComparison", jobIds: [JOB_A, JOB_B], rowOrder: ["pay", "pay"], verdict: "x" }]);
    expect((await errorsOf(repeatedRow)).length).toBeGreaterThan(0);
  });

  test("variants without a grammar yet fail, so present falls back to variant 1", async () => {
    expect(await validateSurface(v1([{ type: "Callout", tone: "info", text: "x" }]), 2, ctx())).toEqual({
      ok: false, errors: ["variant 2 has no grammar yet"],
    });
  });
});
