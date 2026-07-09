import { describe, expect, test } from "vitest";
import { TAILORED_RESUME_SCHEMA, buildResumePrompt, assembleResume, roleIdentity } from "@/lib/rolefit/resumeSchema";
import { ENGLISH_ONLY_INSTRUCTION, NO_FABRICATION_INSTRUCTION } from "@/lib/rolefit/promptPolicy";
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

const PROFILE: ParsedProfile = {
  name: "Alex Morgan",
  contact: "alex@example.com | 555-0100 | github.com/alex",
  // Deliberately NOT most-advanced first — sortEducation must reorder these.
  educationEntries: ["B.A. Math", "M.S. CS"],
  certifications: ["AWS Solutions Architect Associate"],
  experience: [
    { role: "Lead AI/ML Engineer", company: "Cobalt Labs", dates: "2021 – Present", sourceBullets: ["Built X", "Shipped Y"] },
    { role: "Engineer", company: "Tin Co", dates: "2018 – 2021", sourceBullets: ["Wrote Z"] },
  ],
};

describe("buildResumePrompt", () => {
  const out = buildResumePrompt({
    profile: PROFILE,
    resumeText: "Alex Morgan — Senior Engineer, React/TS",
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
  });
  test("includes the candidate background text", () => { expect(out.user).toContain("Alex Morgan"); });
  test("system prompt mandates English output", () => { expect(out.system).toContain(ENGLISH_ONLY_INSTRUCTION); });
  test("system prompt embeds the shared no-fabrication fragment", () => { expect(out.system).toContain(NO_FABRICATION_INSTRUCTION); });
  test("includes the job title, company, and JD", () => {
    expect(out.user).toContain("Frontend Engineer");
    expect(out.user).toContain("Cobalt");
    expect(out.user).toContain("Build React apps.");
  });
  test("lists the candidate's roles in order with their source bullets", () => {
    expect(out.user).toContain("Cobalt Labs");
    expect(out.user).toContain("Tin Co");
    expect(out.user).toContain("Built X");
    expect(out.user.indexOf("Cobalt Labs")).toBeLessThan(out.user.indexOf("Tin Co"));
  });
  test("system instructs tailoring without fabrication", () => {
    expect(out.system.toLowerCase()).toContain("tailor");
    expect(out.system.toLowerCase()).toContain("never invent");
  });
  test("handles a missing JD", () => {
    const o = buildResumePrompt({ profile: PROFILE, resumeText: "x", job: { title: "T", company: "C", description: null } });
    expect(o.user).toContain("T");
  });
});

describe("TAILORED_RESUME_SCHEMA", () => {
  test("declares only the tailored fields (no fixed fields)", () => {
    const s = JSON.stringify(TAILORED_RESUME_SCHEMA);
    for (const k of ["headline", "summary", "skills", "experience", "company", "bullets"]) {
      expect(s).toContain(k);
    }
    // Fixed/deterministic fields are NOT requested from the model.
    expect(TAILORED_RESUME_SCHEMA.json_schema.schema.required).toEqual([
      "headlineFocus", "summary", "skills", "experience",
    ]);
    expect(TAILORED_RESUME_SCHEMA.json_schema.strict).toBe(true);
  });
});

describe("roleIdentity", () => {
  test("strips a leading seniority qualifier", () => {
    expect(roleIdentity("Lead AI/ML Engineer")).toBe("AI/ML Engineer");
    expect(roleIdentity("Senior Software Engineer")).toBe("Software Engineer");
    expect(roleIdentity("Sr. Data Scientist")).toBe("Data Scientist");
    expect(roleIdentity("Principal Architect")).toBe("Architect");
  });
  test("leaves un-qualified titles unchanged", () => {
    expect(roleIdentity("Compliance & Marketing Consultant")).toBe("Compliance & Marketing Consultant");
    expect(roleIdentity("Software Engineer")).toBe("Software Engineer");
  });
  test("keeps the original title when stripping would empty it", () => {
    expect(roleIdentity("Senior ")).toBe("Senior");
    expect(roleIdentity("Lead")).toBe("Lead");
  });
});

describe("buildResumePrompt — per-job instructions", () => {
  test("an instructions arg renders a CANDIDATE FOCUS / AVOID block in the user prompt", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "Alex Morgan — Senior Engineer, React/TS",
      job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
      instructions: "Emphasize the ML platform work; avoid frontend framing.",
    });
    expect(user).toContain("CANDIDATE FOCUS / AVOID");
    expect(user).toContain("Emphasize the ML platform work; avoid frontend framing.");
  });

  test("no instructions → no block (prompt unchanged)", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "x",
      job: { title: "T", company: "C", description: null },
    });
    expect(user).not.toContain("CANDIDATE FOCUS / AVOID");
  });
});

describe("assembleResume", () => {
  test("deterministic fields come from the profile; tailored fields from the model", () => {
    const out = assembleResume(PROFILE, {
      headlineFocus: "Tailored headline",
      summary: "Tailored summary.",
      skills: ["React", "TypeScript"],
      experience: [
        { company: "Cobalt Labs", bullets: ["Tailored A", "Tailored B"] },
        { company: "Tin Co", bullets: ["Tailored Z"] },
      ],
    });
    // Deterministic — verbatim from the ParsedProfile.
    expect(out.name).toBe("Alex Morgan");
    expect(out.contact).toBe("alex@example.com | 555-0100 | github.com/alex");
    // Education ordered most-advanced first; certifications passed through.
    expect(out.education).toEqual(["M.S. CS", "B.A. Math"]);
    expect(out.certifications).toEqual(["AWS Solutions Architect Associate"]);
    expect(out.experience.map((e) => [e.role, e.company, e.dates])).toEqual([
      ["Lead AI/ML Engineer", "Cobalt Labs", "2021 – Present"],
      ["Engineer", "Tin Co", "2018 – 2021"],
    ]);
    // Headline = deterministic role identity ("Lead" stripped) + tailored focus.
    expect(out.headline).toBe("AI/ML Engineer | Tailored headline");
    expect(out.summary).toBe("Tailored summary.");
    expect(out.skills).toEqual(["React", "TypeScript"]);
    expect(out.experience[0].bullets).toEqual(["Tailored A", "Tailored B"]);
    expect(out.experience[1].bullets).toEqual(["Tailored Z"]);
  });

  test("matches tailored bullets by company when order/index differs", () => {
    const out = assembleResume(PROFILE, {
      headlineFocus: "h", summary: "s", skills: [],
      experience: [
        { company: "Tin Co", bullets: ["Z-tailored"] },
        { company: "Cobalt Labs", bullets: ["Cobalt-tailored"] },
      ],
    });
    expect(out.experience[0].company).toBe("Cobalt Labs");
    expect(out.experience[0].bullets).toEqual(["Cobalt-tailored"]);
    expect(out.experience[1].bullets).toEqual(["Z-tailored"]);
  });

  test("falls back to source bullets when a tailored role is missing or empty", () => {
    const out = assembleResume(PROFILE, {
      headlineFocus: "h", summary: "s", skills: [],
      experience: [
        { company: "Cobalt Labs", bullets: [] }, // empty → fall back
        // Tin Co omitted entirely → fall back
      ],
    });
    expect(out.experience[0].bullets).toEqual(["Built X", "Shipped Y"]);
    expect(out.experience[1].bullets).toEqual(["Wrote Z"]);
  });
});

describe("buildResumePrompt — profile-level generation instructions", () => {
  test("a profileInstructions arg renders a PROFILE-WIDE GENERATION GUIDANCE block", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "Alex Morgan — Senior Engineer, React/TS",
      job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
      profileInstructions: "Keep it to one page; prefer metric-led bullets.",
    });
    expect(user).toContain("PROFILE-WIDE GENERATION GUIDANCE");
    expect(user).toContain("Keep it to one page; prefer metric-led bullets.");
    // The profile block carries the anti-fabrication guardrail — lock its exact wording
    // so a future edit can't silently drop the "no unsupported skills/experience" bar.
    expect(user).toContain("never licenses adding unsupported skills or experience");
  });

  test("no profileInstructions → no profile block", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "x",
      job: { title: "T", company: "C", description: null },
    });
    expect(user).not.toContain("PROFILE-WIDE GENERATION GUIDANCE");
  });

  test("profile-wide block renders ABOVE the per-job CANDIDATE FOCUS / AVOID block", () => {
    const { user } = buildResumePrompt({
      profile: PROFILE,
      resumeText: "x",
      job: { title: "T", company: "C", description: null },
      profileInstructions: "Standing guidance.",
      instructions: "This-job focus.",
    });
    expect(user).toContain("PROFILE-WIDE GENERATION GUIDANCE");
    expect(user).toContain("CANDIDATE FOCUS / AVOID");
    expect(user.indexOf("PROFILE-WIDE GENERATION GUIDANCE"))
      .toBeLessThan(user.indexOf("CANDIDATE FOCUS / AVOID"));
  });
});
