import { describe, expect, test } from "vitest";
import { COVER_LETTER_JSON_SCHEMA, buildCoverLetterPrompt } from "@/lib/rolefit/coverLetterSchema";
import { ENGLISH_ONLY_INSTRUCTION, NO_FABRICATION_INSTRUCTION } from "@/lib/rolefit/promptPolicy";

const JOB = {
  title: "Frontend Engineer",
  company: "Cobalt",
  description: "Build React apps.",
  about: "Cobalt builds developer tooling.",
  requirements: [{ text: "5y React", met: true }, { text: "GraphQL", met: false }],
  skillGaps: ["GraphQL"],
  redFlags: ["Comp below target"],
};

describe("buildCoverLetterPrompt", () => {
  const out = buildCoverLetterPrompt({
    resumeText: "Alex Morgan — Senior Engineer, React/TS",
    candidateName: "Alex Morgan",
    instructions: "focus on backend/infra",
    job: JOB,
  });
  test("includes the candidate résumé and name", () => {
    expect(out.user).toContain("Alex Morgan");
  });
  test("includes the job title, company, and JD", () => {
    expect(out.user).toContain("Frontend Engineer");
    expect(out.user).toContain("Cobalt");
    expect(out.user).toContain("Build React apps.");
  });
  test("includes the rich review context (about + requirements)", () => {
    expect(out.user).toContain("developer tooling");
    expect(out.user).toContain("5y React");
  });
  test("marks each requirement's met status so unmet ones are never claimed", () => {
    expect(out.user).toContain("[MET] 5y React");
    expect(out.user).toContain("[NOT MET] GraphQL");
  });
  test("threads candidate focus instructions", () => {
    expect(out.user).toContain("backend/infra");
  });
  test("system instructs tailoring without fabrication", () => {
    expect(out.system.toLowerCase()).toContain("never invent");
    expect(out.system).toContain(NO_FABRICATION_INSTRUCTION);
  });
  test("system prompt mandates English output", () => {
    expect(out.system).toContain(ENGLISH_ONLY_INSTRUCTION);
  });
  test("handles a missing JD / about / context", () => {
    const o = buildCoverLetterPrompt({
      resumeText: "x",
      candidateName: null,
      instructions: null,
      job: { title: "T", company: "C", description: null, about: null, requirements: [], skillGaps: [], redFlags: [] },
    });
    expect(o.user).toContain("T");
    expect(o.user).toContain("(none provided)");
  });
});

describe("buildCoverLetterPrompt — profile-level generation instructions", () => {
  test("a profileInstructions arg renders a PROFILE-WIDE GENERATION GUIDANCE block", () => {
    const { user } = buildCoverLetterPrompt({
      resumeText: "Alex Morgan — Senior Engineer",
      candidateName: "Alex Morgan",
      instructions: null,
      profileInstructions: "Warm but professional tone.",
      job: JOB,
    });
    expect(user).toContain("PROFILE-WIDE GENERATION GUIDANCE");
    expect(user).toContain("Warm but professional tone.");
  });

  test("no profileInstructions → no profile block", () => {
    const { user } = buildCoverLetterPrompt({
      resumeText: "x", candidateName: null, instructions: null, job: JOB,
    });
    expect(user).not.toContain("PROFILE-WIDE GENERATION GUIDANCE");
  });

  test("profile-wide block renders ABOVE the per-job CANDIDATE FOCUS / AVOID block", () => {
    const { user } = buildCoverLetterPrompt({
      resumeText: "x",
      candidateName: null,
      instructions: "This-job focus.",
      profileInstructions: "Standing guidance.",
      job: JOB,
    });
    expect(user).toContain("PROFILE-WIDE GENERATION GUIDANCE");
    expect(user).toContain("CANDIDATE FOCUS / AVOID");
    expect(user.indexOf("PROFILE-WIDE GENERATION GUIDANCE"))
      .toBeLessThan(user.indexOf("CANDIDATE FOCUS / AVOID"));
  });
});

describe("COVER_LETTER_JSON_SCHEMA", () => {
  test("declares the required cover-letter fields", () => {
    const s = JSON.stringify(COVER_LETTER_JSON_SCHEMA);
    for (const k of ["greeting", "paragraphs", "closing", "signature"]) {
      expect(s).toContain(k);
    }
  });
});
