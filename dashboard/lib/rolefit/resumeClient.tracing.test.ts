// dashboard/lib/rolefit/resumeClient.tracing.test.ts
//
// Focused unit test for the tracing-ENABLED path of generateResume, which the
// sibling resumeClient.test.ts (tracing disabled) can't reach. Proves the `resume`
// parent span now lives in the shared client: it wraps the call in
// startActiveObservation, stamps the span input with the candidate background,
// stamps a trace-level `generated_at` via propagateAttributes, and returns the
// span's traceId. Per-file module mocks force tracingEnabled() true here without
// disturbing the other resumeClient tests.
import { describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => {
  const spanUpdate = vi.fn();
  const span = { traceId: "trace-xyz", update: spanUpdate };
  const propagateAttributes = vi.fn((_attrs: unknown, fn: () => unknown) => fn());
  const startActiveObservation = vi.fn((_name: string, fn: (s: unknown) => unknown) => fn(span));
  return { span, spanUpdate, propagateAttributes, startActiveObservation };
});

// tracingEnabled() true → generateResume takes the parent-span branch. openrouterClient
// also imports tracingEnabled from here, so returning true routes its inner
// `resume-generation` observation through the mocked startObservation below.
vi.mock("@/lib/observability", () => ({ tracingEnabled: () => true, ensureTracingStarted: async () => {} }));
vi.mock("@langfuse/tracing", () => ({
  startActiveObservation: h.startActiveObservation,
  propagateAttributes: h.propagateAttributes,
  // The inner generation span the shared transport opens — only needs update()/end().
  startObservation: () => ({ update() {}, end() {} }),
}));

import { generateResume } from "@/lib/rolefit/resumeClient";

// Model returns ONLY the tailored fields; the fixed fields come from parsing the text.
const TAILORED = {
  headlineFocus: "Modern web apps",
  summary: "Tailored summary.",
  skills: ["React", "TypeScript"],
  experience: [{ company: "Cobalt Inc", bullets: ["Tailored bullet about apps"] }],
};

const RESUME_TEXT = [
  "Alex Morgan",
  "alex@example.com | 555-0100",
  "Experience",
  "2020 - 2023",
  "Cobalt Inc",
  "Frontend Engineer",
  "- Built apps",
].join("\n");

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

describe("generateResume — tracing enabled", () => {
  test("wraps the call in the `resume` span, stamps trace-level generated_at, returns the trace id", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(TAILORED) } }] });
    const { resume, traceId } = await generateResume({
      resumeText: RESUME_TEXT,
      job: { title: "Frontend Engineer", company: "Cobalt", description: "Build apps." },
      model: "test/model",
      apiKey: "sk-test",
      fetchImpl: f,
    });

    // The résumé still assembles correctly under the span.
    expect(resume.name).toBe("Alex Morgan");
    // traceId is the parent span's id, threaded out for the golden-dataset join.
    expect(traceId).toBe("trace-xyz");

    // span.update stamped the input with the candidate's real background résumé.
    expect(h.spanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ background: RESUME_TEXT }) }),
    );

    // propagateAttributes stamped a trace-level generated_at that parses as a Date.
    expect(h.propagateAttributes).toHaveBeenCalledTimes(1);
    const attrs = h.propagateAttributes.mock.calls[0][0] as { metadata?: { generated_at?: unknown } };
    const generatedAt = attrs.metadata?.generated_at;
    expect(typeof generatedAt).toBe("string");
    expect(Number.isNaN(new Date(generatedAt as string).getTime())).toBe(false);
  });
});
