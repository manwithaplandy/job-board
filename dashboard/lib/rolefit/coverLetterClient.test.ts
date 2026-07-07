// dashboard/lib/rolefit/coverLetterClient.test.ts
import { describe, expect, test, vi } from "vitest";

// This suite covers the tracing-OFF return path (traceId === null). tracingEnabled()
// keys off LANGFUSE_PUBLIC_KEY/SECRET_KEY, which the langfuse-cli creds export into a
// local shell — pin it false so the suite is deterministic regardless of ambient env.
// The tracing-ON path lives in coverLetterClient.tracing.test.ts (which pins it true).
vi.mock("@/lib/observability", () => ({
  tracingEnabled: () => false,
  flushLangfuseTraces: async () => {},
}));

import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";

const LETTER = {
  greeting: "Dear Hiring Manager,",
  paragraphs: ["I'm excited to apply.", "My background fits."],
  closing: "Sincerely,",
  signature: "Alex Morgan",
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

describe("generateCoverLetter", () => {
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

  test("posts model + messages + response_format and returns parsed letter", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(LETTER) } }] });
    const out = await generateCoverLetter({ ...args, fetchImpl: f });
    expect(out.letter.greeting).toBe("Dear Hiring Manager,");
    expect(out.letter.paragraphs).toHaveLength(2);
    expect(out.traceId).toBeNull(); // tracing is off in this suite
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.model).toBe("test/model");
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body.messages)).toContain("Cobalt");
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  test("throws on non-ok response", async () => {
    await expect(generateCoverLetter({ ...args, fetchImpl: fakeFetch({}, false) })).rejects.toThrow();
  });

  test("throws when content is not valid cover-letter JSON", async () => {
    const f = fakeFetch({ choices: [{ message: { content: "not json" } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("throws when required fields are missing", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ greeting: "Hi" }) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("throws when closing is missing (renderer dereferences it)", async () => {
    const noClosing = { greeting: "Hi", paragraphs: ["p"], signature: "Alex" };
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(noClosing) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("throws when signature is missing (renderer dereferences it)", async () => {
    const noSignature = { greeting: "Hi", paragraphs: ["p"], closing: "Sincerely," };
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(noSignature) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("throws when greeting/closing/signature are empty strings, not just missing", async () => {
    const emptyGreeting = { ...LETTER, greeting: "" };
    const f1 = fakeFetch({ choices: [{ message: { content: JSON.stringify(emptyGreeting) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f1 })).rejects.toThrow("missing required fields");

    const emptyClosing = { ...LETTER, closing: "" };
    const f2 = fakeFetch({ choices: [{ message: { content: JSON.stringify(emptyClosing) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f2 })).rejects.toThrow("missing required fields");

    const emptySignature = { ...LETTER, signature: "" };
    const f3 = fakeFetch({ choices: [{ message: { content: JSON.stringify(emptySignature) } }] });
    await expect(generateCoverLetter({ ...args, fetchImpl: f3 })).rejects.toThrow("missing required fields");
  });
});

test("DEFAULT_COVER_MODEL is claude haiku", () => {
  expect(DEFAULT_COVER_MODEL).toBe("anthropic/claude-haiku-4.5");
});
