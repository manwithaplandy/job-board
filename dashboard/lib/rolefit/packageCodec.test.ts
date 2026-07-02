import { describe, expect, test } from "vitest";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import {
  unwrapJsonb,
  parseTailoredResume,
  parseTailoredCoverLetter,
  parsePrefilledAnswers,
  parseApplicationAnswers,
  parseGreenhouseQuestionsJsonb,
} from "@/lib/rolefit/packageCodec";

const validResume: TailoredResume = {
  name: "Andrew Malvani",
  contact: "a@b.com | San Diego, CA",
  headline: "AI/ML Engineer | LLM Integration",
  summary: "Senior engineer with 5+ years shipping LLM systems.",
  skills: ["Python", "LLMs", "Postgres"],
  experience: [
    { role: "Staff Engineer", company: "Acme", dates: "2020–2024", bullets: ["Built X", "Cut Y 40%"] },
  ],
  education: ["MS Computer Science"],
  certifications: [],
};

const validCover: TailoredCoverLetter = {
  greeting: "Dear Hiring Manager,",
  paragraphs: ["Para one.", "Para two."],
  closing: "Sincerely,",
  signature: "Andrew Malvani",
};

describe("unwrapJsonb", () => {
  test("passes objects through unchanged", () => {
    expect(unwrapJsonb(validResume)).toEqual(validResume);
  });
  test("parses a double-encoded JSON string into its value", () => {
    expect(unwrapJsonb(JSON.stringify(validResume))).toEqual(validResume);
  });
  test("returns a non-JSON string unchanged (object guards reject it later)", () => {
    expect(unwrapJsonb("not json")).toBe("not json");
  });
  test("passes null and numbers through", () => {
    expect(unwrapJsonb(null)).toBeNull();
    expect(unwrapJsonb(7)).toBe(7);
  });
});

describe("parseTailoredResume", () => {
  test("accepts a valid résumé object", () => {
    expect(parseTailoredResume(validResume)).toEqual(validResume);
  });
  test("REPAIRS a double-encoded résumé string (the vetcove bug)", () => {
    expect(parseTailoredResume(JSON.stringify(validResume))).toEqual(validResume);
  });
  test("rejects a scalar string", () => {
    expect(parseTailoredResume("Andrew Malvani")).toBeNull();
  });
  test("rejects when skills is not a string array", () => {
    expect(parseTailoredResume({ ...validResume, skills: "Python" })).toBeNull();
  });
  test("rejects when an experience entry is malformed", () => {
    expect(parseTailoredResume({ ...validResume, experience: [{ role: "X" }] })).toBeNull();
  });
  test("rejects null/undefined", () => {
    expect(parseTailoredResume(null)).toBeNull();
    expect(parseTailoredResume(undefined)).toBeNull();
  });
});

describe("parseTailoredCoverLetter", () => {
  test("accepts a valid cover letter", () => {
    expect(parseTailoredCoverLetter(validCover)).toEqual(validCover);
  });
  test("repairs a double-encoded cover-letter string", () => {
    expect(parseTailoredCoverLetter(JSON.stringify(validCover))).toEqual(validCover);
  });
  test("rejects when paragraphs is missing", () => {
    expect(parseTailoredCoverLetter({ ...validCover, paragraphs: undefined })).toBeNull();
  });
});

describe("parsePrefilledAnswers", () => {
  test("keeps valid answers, trimmed", () => {
    expect(parsePrefilledAnswers([{ question: " Q ", answer: " A " }])).toEqual([
      { question: "Q", answer: "A" },
    ]);
  });
  test("drops malformed / empty items but stays an array", () => {
    expect(
      parsePrefilledAnswers([{ question: "Q", answer: "" }, { nope: 1 }, { question: "Q2", answer: "A2" }]),
    ).toEqual([{ question: "Q2", answer: "A2" }]);
  });
  test("repairs a double-encoded array string", () => {
    expect(parsePrefilledAnswers(JSON.stringify([{ question: "Q", answer: "A" }]))).toEqual([
      { question: "Q", answer: "A" },
    ]);
  });
  test("returns null when the value is not an array", () => {
    expect(parsePrefilledAnswers({ question: "Q", answer: "A" })).toBeNull();
    expect(parsePrefilledAnswers("nope")).toBeNull();
  });
});

describe("parseApplicationAnswers", () => {
  test("accepts an object", () => {
    const a = { full_name: "Andrew", email: "a@b.com" };
    expect(parseApplicationAnswers(a)).toEqual(a);
  });
  test("repairs a double-encoded object string", () => {
    const a = { full_name: "Andrew" };
    expect(parseApplicationAnswers(JSON.stringify(a))).toEqual(a);
  });
  test("rejects a scalar string", () => {
    expect(parseApplicationAnswers("Andrew")).toBeNull();
  });
});

describe("parseGreenhouseQuestionsJsonb", () => {
  test("parses a valid questions object", () => {
    const gq = { questions: [{ label: "Why us?", required: true, fields: [] }] };
    expect(parseGreenhouseQuestionsJsonb(gq)).toEqual({
      questions: [{ label: "Why us?", required: true, fields: [] }],
    });
  });
  test("repairs a double-encoded questions string", () => {
    const gq = { questions: [{ label: "Why us?", required: false, fields: [] }] };
    expect(parseGreenhouseQuestionsJsonb(JSON.stringify(gq))).toEqual({
      questions: [{ label: "Why us?", required: false, fields: [] }],
    });
  });
  test("returns null for a scalar", () => {
    expect(parseGreenhouseQuestionsJsonb("nope")).toBeNull();
  });
});
