import { describe, expect, test } from "vitest";
import { RESUME_JSON_SCHEMA, buildResumePrompt } from "@/lib/rolefit/resumeSchema";

describe("buildResumePrompt", () => {
  const out = buildResumePrompt({
    resumeText: "Alex Morgan — Senior Engineer, React/TS",
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
  });
  test("includes the candidate resume", () => { expect(out.user).toContain("Alex Morgan"); });
  test("includes the job title, company, and JD", () => {
    expect(out.user).toContain("Frontend Engineer");
    expect(out.user).toContain("Cobalt");
    expect(out.user).toContain("Build React apps.");
  });
  test("system instructs tailoring without fabrication", () => {
    expect(out.system.toLowerCase()).toContain("tailor");
  });
  test("handles a missing JD", () => {
    const o = buildResumePrompt({ resumeText: "x", job: { title: "T", company: "C", description: null } });
    expect(o.user).toContain("T");
  });
});

describe("RESUME_JSON_SCHEMA", () => {
  test("declares the required résumé fields", () => {
    const s = JSON.stringify(RESUME_JSON_SCHEMA);
    for (const k of ["name", "headline", "summary", "skills", "experience", "education"]) {
      expect(s).toContain(k);
    }
  });
});
