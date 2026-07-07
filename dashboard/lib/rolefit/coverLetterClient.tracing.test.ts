// Tracing-ON companion to coverLetterClient.test.ts (which runs with tracing OFF).
// Proves the shared `cover-letter` parent span: input/output on the span + a
// trace-level `generated_at` via propagateAttributes. Per-file module mocks flip
// tracingEnabled() true and stub @langfuse/tracing (both the parent span here AND
// the generation-level startObservation inside callOpenRouterStructured).
import { beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  span: { traceId: "t", update: vi.fn() },
  propagateArgs: [] as unknown[],
}));

vi.mock("@/lib/observability", () => ({
  tracingEnabled: () => true,
  flushLangfuseTraces: async () => {},
}));
vi.mock("@langfuse/tracing", () => ({
  startActiveObservation: (_name: string, fn: (span: unknown) => unknown) => fn(h.span),
  propagateAttributes: (attrs: unknown, fn: () => unknown) => { h.propagateArgs.push(attrs); return fn(); },
  // The generation-level span opened inside callOpenRouterStructured — no-op here.
  startObservation: () => ({ update() {}, end() {} }),
}));

import { generateCoverLetter } from "@/lib/rolefit/coverLetterClient";

const LETTER = {
  greeting: "Dear Hiring Manager,",
  paragraphs: ["I'm excited to apply.", "My background fits."],
  closing: "Sincerely,",
  signature: "Alex Morgan",
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

const args = {
  resumeText: "Alex Morgan, React engineer",
  candidateName: "Alex Morgan",
  instructions: null,
  job: {
    title: "Frontend Engineer", company: "Cobalt", description: "Build apps.",
    about: "Devtools.", requirements: [{ text: "React", met: true }],
    skillGaps: [], redFlags: [],
  },
  model: "test/model", apiKey: "sk-test",
};

beforeEach(() => {
  h.span.update.mockClear();
  h.propagateArgs.length = 0;
});

describe("generateCoverLetter — tracing enabled", () => {
  test("opens a cover-letter span (input+output) and stamps a trace-level generated_at", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(LETTER) } }] });
    const out = await generateCoverLetter({ ...args, fetchImpl: f });

    // Returned letter is the parsed model output.
    expect(out.greeting).toBe("Dear Hiring Manager,");
    expect(out.paragraphs).toEqual(LETTER.paragraphs);

    // span.update was called with input carrying the candidate background.
    const inputCall = h.span.update.mock.calls.find((c) => (c[0] as { input?: unknown }).input);
    expect(inputCall).toBeDefined();
    const input = (inputCall![0] as { input: { background: string; title: string; company: string } }).input;
    expect(input.background).toBe(args.resumeText);
    expect(input.title).toBe(args.job.title);
    expect(input.company).toBe(args.job.company);

    // span.update was later called with a composed plain-text output string.
    const outputCall = h.span.update.mock.calls.find((c) => typeof (c[0] as { output?: unknown }).output === "string");
    expect(outputCall).toBeDefined();
    const outputText = (outputCall![0] as { output: string }).output;
    expect(outputText).toContain("Dear Hiring Manager,");
    expect(outputText).toContain("Alex Morgan");

    // propagateAttributes received a metadata.generated_at that parses as a Date.
    expect(h.propagateArgs).toHaveLength(1);
    const meta = (h.propagateArgs[0] as { metadata: { generated_at: string } }).metadata;
    expect(typeof meta.generated_at).toBe("string");
    expect(Number.isNaN(Date.parse(meta.generated_at))).toBe(false);
  });
});
