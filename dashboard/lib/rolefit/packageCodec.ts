// dashboard/lib/rolefit/packageCodec.ts
//
// The trust boundary for application_packages jsonb columns. postgres.js returns
// jsonb as parsed JS values — but a jsonb *string scalar* (a double-encoded write)
// comes back as a JS STRING, not an object. Casting that string `as TailoredResume`
// let it reach React, where `data.skills.map(...)` threw and took down the whole board.
//
// Every parser here is PURE and TOTAL: it unwraps a possibly double-encoded value,
// validates exactly the fields the renderers dereference, and returns a valid typed
// object or null. Mirrors the existing hand-rolled idiom (parseGreenhouseQuestions,
// parseBoardFilters). No zod.
import type { TailoredResume, ResumeExperience } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import type { ApplicationAnswers } from "@/lib/types";
import { parseGreenhouseQuestions, type GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

/** If a jsonb value came back as a JSON string (double-encoded scalar), parse it once.
 *  On parse failure the raw string is returned so the caller's object guard rejects it. */
export function unwrapJsonb(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/** Valid TailoredResume or null. Shape-validates (types), not content (allows empties),
 *  so a well-formed assembleResume() output always passes. */
export function parseTailoredResume(raw: unknown): TailoredResume | null {
  const o = unwrapJsonb(raw);
  if (!isObj(o)) return null;
  if (!isStr(o.name) || !isStr(o.contact) || !isStr(o.headline) || !isStr(o.summary)) return null;
  if (!isStrArr(o.skills) || !isStrArr(o.education) || !isStrArr(o.certifications)) return null;
  if (!Array.isArray(o.experience)) return null;
  const experience: ResumeExperience[] = [];
  for (const e of o.experience) {
    if (!isObj(e) || !isStr(e.role) || !isStr(e.company) || !isStr(e.dates) || !isStrArr(e.bullets)) {
      return null;
    }
    experience.push({ role: e.role, company: e.company, dates: e.dates, bullets: e.bullets });
  }
  return {
    name: o.name,
    contact: o.contact,
    headline: o.headline,
    summary: o.summary,
    skills: o.skills,
    experience,
    education: o.education,
    certifications: o.certifications,
  };
}

/** Valid TailoredCoverLetter or null. */
export function parseTailoredCoverLetter(raw: unknown): TailoredCoverLetter | null {
  const o = unwrapJsonb(raw);
  if (!isObj(o)) return null;
  if (!isStr(o.greeting) || !isStrArr(o.paragraphs) || !isStr(o.closing) || !isStr(o.signature)) {
    return null;
  }
  return { greeting: o.greeting, paragraphs: o.paragraphs, closing: o.closing, signature: o.signature };
}

/** Array of valid, trimmed answers, or null when the value is not an array.
 *  (An empty array is a valid result — merge code already tolerates it.) */
export function parsePrefilledAnswers(raw: unknown): PrefilledAnswer[] | null {
  const a = unwrapJsonb(raw);
  if (!Array.isArray(a)) return null;
  const out: PrefilledAnswer[] = [];
  for (const item of a) {
    if (!isObj(item) || !isStr(item.question) || !isStr(item.answer)) continue;
    const question = item.question.trim();
    const answer = item.answer.trim();
    if (question && answer) out.push({ question, answer });
  }
  return out;
}

/** Object shape or null. answers_snapshot is never `.map`-ed in the UI and every
 *  reader uses optional chaining, so a shallow object guard (reject scalars) is the
 *  right, proportional check here. */
export function parseApplicationAnswers(raw: unknown): ApplicationAnswers | null {
  const o = unwrapJsonb(raw);
  if (!isObj(o)) return null;
  return o as unknown as ApplicationAnswers;
}

/** parseGreenhouseQuestions, but first unwrap a possibly double-encoded jsonb string. */
export function parseGreenhouseQuestionsJsonb(raw: unknown): GreenhouseQuestions | null {
  return parseGreenhouseQuestions(unwrapJsonb(raw));
}
