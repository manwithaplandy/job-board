// dashboard/lib/rolefit/resumeClient.test.ts
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";

// The model now returns ONLY the tailored fields; the fixed fields come from
// parsing the résumé text below.
const TAILORED = {
  headlineFocus: "Modern web apps",
  summary: "Tailored summary.",
  skills: ["React", "TypeScript"],
  experience: [{ company: "Cobalt Inc", bullets: ["Tailored bullet about apps"] }],
};

// Parses (via the text fallback) to name + contact + one role.
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

describe("generateResume", () => {
  const args = {
    resumeText: RESUME_TEXT,
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build apps." },
    model: "test/model", apiKey: "sk-test",
  };

  test("assembles deterministic fields from parsing + tailored fields from the model", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify(TAILORED) } }] });
    const out = await generateResume({ ...args, fetchImpl: f });
    // Deterministic — from parsing the résumé text, not the model.
    expect(out.name).toBe("Alex Morgan");
    expect(out.contact).toBe("alex@example.com | 555-0100");
    // Tailored — deterministic role identity ("Frontend Engineer") + model focus.
    expect(out.headline).toBe("Frontend Engineer | Modern web apps");
    expect(out.experience[0].company).toBe("Cobalt Inc");
    expect(out.experience[0].bullets).toEqual(["Tailored bullet about apps"]);

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
