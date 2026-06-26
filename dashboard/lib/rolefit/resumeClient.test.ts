// dashboard/lib/rolefit/resumeClient.test.ts
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";

const RESUME = {
  name: "Alex Morgan", headline: "Senior Engineer", summary: "…",
  skills: ["React"], experience: [{ role: "SWE", company: "X", dates: "2020", bullets: ["a"] }],
  education: "BS CS",
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

describe("generateResume", () => {
  const args = {
    resumeText: "Alex Morgan, React engineer",
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build apps." },
    model: "test/model", apiKey: "sk-test",
  };

  test("posts model + messages + response_format and returns parsed résumé", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(RESUME) } }] });
    const out = await generateResume({ ...args, fetchImpl: f });
    expect(out.name).toBe("Alex Morgan");
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.model).toBe("test/model");
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body.messages)).toContain("Cobalt");
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  test("throws on non-ok response", async () => {
    await expect(generateResume({ ...args, fetchImpl: fakeFetch({}, false) })).rejects.toThrow();
  });

  test("throws when content is not valid résumé JSON", async () => {
    const f = fakeFetch({ choices: [{ message: { content: "not json" } }] });
    await expect(generateResume({ ...args, fetchImpl: f })).rejects.toThrow();
  });
});

test("DEFAULT_RESUME_MODEL is claude haiku", () => {
  expect(DEFAULT_RESUME_MODEL).toBe("anthropic/claude-haiku-4.5");
});
