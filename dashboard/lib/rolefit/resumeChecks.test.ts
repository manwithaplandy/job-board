import { describe, it, expect } from "vitest";
import { resumeChecks } from "./resumeChecks";
import type { TailoredResume } from "./resumeSchema";
import type { ParsedProfile } from "./parseProfile";

function base(): TailoredResume {
  return {
    name: "A", contact: "a@x.com", headline: "Engineer | infra",
    summary: "Senior engineer.",
    skills: ["Python", "Go", "AWS", "Docker", "Kubernetes", "Postgres",
             "Redis", "React", "TypeScript", "Node.js", "GraphQL", "Terraform"],
    experience: [{ role: "Eng", company: "Acme", dates: "2021 – Present",
                   bullets: ["Built the platform", "Shipped the API"] }],
    education: ["BSc"], certifications: [],
  };
}
function parsed(): ParsedProfile {
  return { name: "A", contact: "", educationEntries: ["BSc"], certifications: [],
    experience: [{ role: "Eng", company: "Acme", dates: "2021 – Present", sourceBullets: [] }] };
}

describe("resumeChecks — résumé-only", () => {
  it("passes a clean résumé", () => {
    const r = resumeChecks(base());
    expect(r.checks.find((c) => c.id === "skills_count")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "skills_dedup")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "verb_repeat")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "bullet_length")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "summary_length")?.pass).toBe(true);
  });
  it("flags <12 or >16 skills", () => {
    const r = base(); r.skills = ["Python", "Go"];
    expect(resumeChecks(r).checks.find((c) => c.id === "skills_count")?.pass).toBe(false);
  });
  it("flags a repeated opening verb across bullets", () => {
    const r = base();
    r.experience[0].bullets = ["Built the platform", "Built the API"];
    expect(resumeChecks(r).checks.find((c) => c.id === "verb_repeat")?.pass).toBe(false);
  });
  it("flags duplicate/subsuming skills (AWS + AWS S3)", () => {
    const r = base(); r.skills = [...r.skills.slice(0, 11), "AWS S3"];
    expect(resumeChecks(r).checks.find((c) => c.id === "skills_dedup")?.pass).toBe(false);
  });
  it("flags a bullet over 24 words", () => {
    const r = base();
    r.experience[0].bullets = ["word ".repeat(25).trim(), "Shipped the API"];
    expect(resumeChecks(r).checks.find((c) => c.id === "bullet_length")?.pass).toBe(false);
  });
  it("flags a summary over 70 words", () => {
    const r = base(); r.summary = "word ".repeat(71).trim();
    expect(resumeChecks(r).checks.find((c) => c.id === "summary_length")?.pass).toBe(false);
  });
  it("flags a headline over 80 chars", () => {
    const r = base(); r.headline = "Senior Staff Software Engineer".repeat(3);
    expect(r.headline.length).toBeGreaterThan(80);
    expect(resumeChecks(r).checks.find((c) => c.id === "headline_length")?.pass).toBe(false);
  });
  it("flags a role with more than 7 bullets", () => {
    const r = base();
    r.experience[0].bullets = [
      "Built the platform", "Shipped the API", "Migrated the database",
      "Automated the pipeline", "Reduced latency", "Scaled the service",
      "Mentored the team", "Owned the roadmap",
    ];
    expect(resumeChecks(r).checks.find((c) => c.id === "bullets_per_role")?.pass).toBe(false);
  });
  it("flags more than 24 total bullets across roles", () => {
    const r = base();
    r.experience = [
      { role: "Eng", company: "Acme", dates: "", bullets: Array.from({ length: 13 }, (_, i) => `Did thing ${i}`) },
      { role: "Eng2", company: "Acme", dates: "", bullets: Array.from({ length: 13 }, (_, i) => `Made thing ${i}`) },
    ];
    expect(resumeChecks(r).checks.find((c) => c.id === "one_page_fit")?.pass).toBe(false);
  });
  it("omits profile-dependent checks when no profile is passed", () => {
    expect(resumeChecks(base()).checks.find((c) => c.id === "roles_present")).toBeUndefined();
  });
});

describe("resumeChecks — with profile", () => {
  it("passes when roles match in order and no foreign company", () => {
    const r = resumeChecks(base(), parsed());
    expect(r.checks.find((c) => c.id === "roles_present")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "no_foreign_company")?.pass).toBe(true);
  });
  it("flags a foreign company not in the profile", () => {
    const res = base(); res.experience[0].company = "Globex";
    expect(resumeChecks(res, parsed()).checks.find((c) => c.id === "no_foreign_company")?.pass).toBe(false);
  });
  it("flags a missing/extra role vs the profile", () => {
    const res = base();
    res.experience.push({ role: "X", company: "Y", dates: "", bullets: [] });
    expect(resumeChecks(res, parsed()).checks.find((c) => c.id === "roles_present")?.pass).toBe(false);
  });
});
