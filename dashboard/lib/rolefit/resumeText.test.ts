import { describe, it, expect } from "vitest";
import { composeResumeText } from "./resumeText";
import type { TailoredResume } from "./resumeSchema";

const RESUME: TailoredResume = {
  name: "Ada Lovelace",
  contact: "ada@example.com",
  headline: "AI/ML Engineer | LLM systems",
  summary: "Senior engineer with 5+ years building ML platforms.",
  skills: ["Python", "PyTorch"],
  experience: [
    { role: "ML Engineer", company: "Acme", dates: "2021 – Present", bullets: ["Built X", "Shipped Y"] },
  ],
  education: ["BSc Computer Science"],
  certifications: ["AWS SA"],
};

describe("composeResumeText", () => {
  it("renders name, headline, summary, skills, experience, education, certs", () => {
    const t = composeResumeText(RESUME);
    expect(t).toContain("Ada Lovelace");
    expect(t).toContain("SUMMARY");
    expect(t).toContain("Python, PyTorch");
    expect(t).toContain("ML Engineer, Acme (2021 – Present)");
    expect(t).toContain("  - Built X");
    expect(t).toContain("Certifications: AWS SA");
  });
});
