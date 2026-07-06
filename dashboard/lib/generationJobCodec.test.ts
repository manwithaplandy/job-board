import { describe, expect, test } from "vitest";
import {
  parseGenerationJob,
  parseGenerationJobList,
  pendingKindsForJob,
  type GenerationJobView,
} from "@/lib/generationJobCodec";

// Total-parser coverage for the generation_jobs boundary (dashboard/CLAUDE.md):
// DB rows arrive snake_case with Date timestamps, wire views camelCase with ISO
// strings — one parser must accept both and reject everything malformed.

const wire = {
  id: "11111111-1111-1111-1111-111111111111",
  jobId: "ashby:planera:d68c8a09-x",
  kind: "resume",
  status: "pending",
  error: null,
  jobTitle: "Engineer",
  company: "Acme",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
};

describe("parseGenerationJob", () => {
  test("accepts a wire-shaped (camelCase, ISO string) view", () => {
    expect(parseGenerationJob(wire)).toEqual(wire);
  });

  test("accepts a DB-shaped (snake_case, Date) row and normalizes to the view", () => {
    const row = {
      id: wire.id,
      job_id: wire.jobId,
      kind: "prepare",
      status: "ready",
      error: "Couldn’t generate the résumé.",
      job_title: "Engineer",
      company: "Acme",
      created_at: new Date("2026-07-05T00:00:00Z"),
      updated_at: new Date("2026-07-05T00:01:00Z"),
    };
    expect(parseGenerationJob(row)).toEqual({
      ...wire,
      kind: "prepare",
      status: "ready",
      error: "Couldn’t generate the résumé.",
      updatedAt: "2026-07-05T00:01:00.000Z",
    });
  });

  test("joined title/company may be absent (deleted job) — parsed as nulls", () => {
    const parsed = parseGenerationJob({ ...wire, jobTitle: undefined, company: null });
    expect(parsed).toMatchObject({ id: wire.id, jobTitle: null, company: null });
  });

  for (const [label, bad] of [
    ["non-object", "a string"],
    ["null", null],
    ["unknown kind", { ...wire, kind: "poem" }],
    ["unknown status", { ...wire, status: "done" }],
    ["missing id", { ...wire, id: undefined }],
    ["missing jobId", { ...wire, jobId: "" }],
    ["missing timestamps", { ...wire, createdAt: 12345 }],
  ] as const) {
    test(`rejects ${label}`, () => {
      expect(parseGenerationJob(bad)).toBeNull();
    });
  }
});

describe("parseGenerationJobList", () => {
  test("parses the envelope and drops malformed entries", () => {
    const body = { generations: [wire, { ...wire, kind: "poem" }, null] };
    expect(parseGenerationJobList(body)).toEqual([wire]);
  });

  for (const [label, bad] of [
    ["non-object body", "html error page"],
    ["missing list", {}],
    ["non-array list", { generations: "nope" }],
  ] as const) {
    test(`malformed envelope (${label}) yields []`, () => {
      expect(parseGenerationJobList(bad)).toEqual([]);
    });
  }
});

describe("pendingKindsForJob", () => {
  const j = (over: Partial<GenerationJobView>): GenerationJobView => ({ ...wire, ...over } as GenerationJobView);

  test("collects only pending kinds for the given job", () => {
    const jobs = [
      j({ id: "a", kind: "resume", status: "pending" }),
      j({ id: "b", kind: "cover", status: "ready" }),
      j({ id: "c", kind: "prepare", status: "pending", jobId: "other-job" }),
    ];
    expect(pendingKindsForJob(jobs, wire.jobId)).toEqual(new Set(["resume"]));
    expect(pendingKindsForJob(jobs, "other-job")).toEqual(new Set(["prepare"]));
    expect(pendingKindsForJob(jobs, "unknown")).toEqual(new Set());
  });
});
