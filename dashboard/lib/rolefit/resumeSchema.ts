// RUNTIME-PURE: import ONLY types from parseProfile (never unpdf or its
// functions) so this module stays safe to import from the client bundle and the
// CLI harness alike.
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

export interface ResumeExperience {
  role: string; company: string; dates: string; bullets: string[];
}
export interface TailoredResume {
  name: string;
  contact: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: string;
}

/**
 * What the LLM now returns: ONLY the job-specific tailored fields. The fixed
 * facts (name, contact, education, and each role's title/company/dates) are
 * supplied deterministically by the parser and merged in by `assembleResume`.
 */
export interface TailoredContent {
  headline: string;
  summary: string;
  skills: string[];
  experience: { company: string; bullets: string[] }[];
}

// OpenRouter (OpenAI-compatible) structured-output schema — tailored fields only.
export const TAILORED_RESUME_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "tailored_resume",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "skills", "experience"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        experience: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["company", "bullets"],
            properties: {
              company: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;

export function buildResumePrompt(args: {
  profile: ParsedProfile;
  /** lossy/full background text — context for skills, domain, and tenure. */
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  /**
   * The candidate's real floored years of experience, computed deterministically
   * from their employment dates (see `yearsOfExperience`). When positive, it is
   * injected as a hard constraint so the model can't mirror the job posting's
   * stated minimum. Stays optional + pure (no clock read here).
   */
  tenureYears?: number | null;
}): { system: string; user: string } {
  const system = `You are an expert résumé writer. You tailor a candidate's REAL background into the job-specific content of a polished, single-page résumé targeted at one role. The candidate's fixed facts — their name, contact line, education, and each role's title, employer, and dates — are SUPPLIED to you verbatim and rendered deterministically; you do NOT output them. Your job is to produce ONLY the tailored content — headline, summary, skills, and the bullet points under each given role — drawn strictly from the candidate's real material. Your JSON is rendered directly into a professionally typeset PDF whose layout AUTOMATICALLY scales to fill exactly one US-Letter page, so supply rich, complete, well-prioritized content — a half-empty page reads as a thin candidate; the goal is a full page of strong, real material.

GROUND RULES — never violate:
- Use only facts present in the candidate's background. Never invent or inflate employers, titles, dates, degrees, certifications, metrics, technologies, or industry/domain experience. If a detail is missing, omit it — do not guess or estimate.
- Keep every number, date, and proper noun internally consistent. The same achievement must carry the same figure wherever it appears (e.g. never "10,000 users" in the summary but "1,000 users" in a bullet).
- Never claim the candidate has worked in, or has experience with, the target role's industry or domain (e.g. healthcare, fintech, e-commerce) unless that industry genuinely appears in their background. Tailoring surfaces transferable skills and matching terminology — it NEVER adopts the employer's industry as the candidate's own. The summary must describe the candidate's real domain, not the job's.
- Write clean, professional American English. Proofread spelling, capitalization, and spacing; never emit truncated or garbled words.

TAILORING — the actual craft:
- Tailor by SELECTION and EMPHASIS, not narration. Lead with the experience, skills, and metrics most relevant to the target role and give them the most space and the sharpest framing; keep the rest but make it leaner.
- Do NOT explain why something is relevant. Ban phrases like "directly analogous to…", "a pattern applicable to…", "demonstrating…", and "which is relevant because…". State the accomplishment and let it stand — the reader infers relevance.
- Where the candidate genuinely matches the job description, mirror its terminology: use the role's own words for skills the candidate actually has.

EXPERIENCE — tailor the bullets for each GIVEN role:
- You are given the candidate's roles IN ORDER, each with its own source accomplishments. Return one experience entry per given role, IN THE SAME ORDER, echoing that role's company verbatim, with tailored bullets. Do NOT add, drop, reorder, merge, or rename roles, and do NOT output titles or dates — those are fixed and supplied separately.
- Draw each role's bullets ONLY from that SAME role's source accomplishments. Never move an accomplishment to a different role, and never invent one. If a role lists no source accomplishments, return an empty bullets array for it.
- bullets: give the most recent / most relevant roles 5–7 substantive bullets — include ALL of that role's strongly quantified, role-relevant accomplishments rather than a subset, since dropping real impact while the page has room is the chief failure to avoid; give older or less-relevant roles 2–3. A role whose source supplies only one accomplishment should normally get one faithful bullet — do not pad it. You may split a single source sentence into two bullets ONLY when it already contains two distinct facts (e.g. a scope/scale clause and a separate responsibility or outcome clause); then partition the sentence's EXISTING clauses across the two bullets and add NOTHING — every word must trace to the source. Never invent a clause, relationship, qualifier, or outcome to enable a split or to reach a bullet count.
- each bullet: open with a strong past-tense verb, lead with the outcome, quantify it with the candidate's real metric, and name the key technologies. One idea per bullet, ≤24 words (one to two lines). Vary the opening verb across EVERY bullet — never reuse the same opening verb (or an obvious synonym, e.g. "Reduced"/"Cut") twice anywhere in the résumé, and this applies across ALL roles, not just within one. The source often reuses a verb (e.g. "Develop"/"Cut" appearing for several achievements); when it does, rewrite all but one with a distinct verb of the same meaning (e.g. "Reduced", "Slashed", "Shortened", "Accelerated", "Designed", "Built") while keeping every metric and fact unchanged. Before finalizing, list your opening verbs and, if any verb or near-synonym repeats, rewrite the duplicates. When the source sentence opens with a headline figure — a dollar amount, percentage, or user count — preserve that figure as the bullet's lead outcome and choose a verb that fronts it (e.g. "Avoided $15M/yr…"); never bury the strongest quantified fact behind a generic verb like "Built", and never drop it. If the source attaches two real metrics to one accomplishment (e.g. monthly and daily active users), keep both.

SKILLS, HEADLINE, SUMMARY:
- skills: 12–16 of the most relevant concrete tools and competencies, ordered by relevance. DEDUPLICATE rigorously — collapse the same skill, a near-duplicate, or an overlapping/qualified variant into ONE canonical entry: list either "CI/CD" or "CI/CD (GitHub Actions)" but NEVER both; never both "Node" and "Node.js", or "AWS" and a specific AWS service already implied. No soft-skill filler.
- headline: one line, ≤90 characters. Professional identity angled toward the role. No employer names, no "tailored for". If you cite years of experience, use the candidate's actual figure computed conservatively from their employment dates — never the minimum the job asks for (e.g. a relevant role that began about three years ago and is ongoing is "3+ years", not the job's "2+ years"). Floor the count to a whole year — a role of about 3.3 years is "3+ years", never rounded up to "4+".
- summary: 2–4 sentences, ≤70 words total. Lead with seniority and the candidate's ACTUAL domain — never the target job's industry — then the two or three most role-relevant, quantified strengths. NEVER restate a minimum the job names (e.g. "2+ years") as the candidate's own qualification — that reads as keyword-matching and undersells them. Instead compute the candidate's actual tenure conservatively from their real employment dates, floored to a whole year, and state that stronger figure (a relevant role that began about three years ago and is ongoing is "3+ years", not "2+ years" and not rounded up to "4+"), or omit a year count entirely. Apply the same rule to the headline. Where the candidate genuinely used a specific technology, name it instead of a generic phrase (e.g. "Postgres/pgvector" rather than only "relational databases").

STYLE:
- Active voice, past tense, no first-person pronouns. No buzzwords or clichés ("results-driven", "team player", "passionate"), no emojis, no filler.

Return only the structured tailored content defined by the schema — no name, contact, education, role titles, companies (other than the echoed company key), dates, notes, or commentary; those are supplied separately.`;

  const rolesBlock = args.profile.experience
    .map((r, i) => {
      const bullets = r.sourceBullets.length
        ? r.sourceBullets.map((b) => `    - ${b}`).join("\n")
        : "    (no source accomplishments provided — return an empty bullets array)";
      return `ROLE ${i + 1} — ${r.role || "(role)"} at ${r.company || "(company)"} (${r.dates})\n  Source accomplishments:\n${bullets}`;
    })
    .join("\n\n");

  const tenureLine =
    typeof args.tenureYears === "number" && args.tenureYears > 0
      ? `\n\nYEARS OF EXPERIENCE: if the headline or summary cites years of experience, use exactly "${args.tenureYears}+ years" — the candidate's real figure computed from their employment dates. Never state a smaller number, never round up, and NEVER use the minimum the job posting asks for.`
      : "";

  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n\n` +
    `JOB DESCRIPTION:\n${args.job.description ?? "(none provided)"}\n\n` +
    `CANDIDATE BACKGROUND (full text — use as context for skills, domain, and tenure):\n${args.resumeText}\n\n` +
    `THE CANDIDATE'S ROLES, IN ORDER. Return one experience entry per role below, in this same order, echoing each company in the "company" field, with tailored bullets drawn ONLY from that role's source accomplishments:\n\n${rolesBlock}\n\n` +
    `Write the tailored content (headline, summary, skills, and per-role bullets) for the target role above, drawing only on the candidate's real material. Follow every rule in your instructions.${tenureLine}`;
  return { system, user };
}

/** Case-insensitive fuzzy company match: equality, substring, or shared first word. */
function companyMatches(a: string, b: string): boolean {
  const A = a.toLowerCase().trim();
  const B = b.toLowerCase().trim();
  if (!A || !B) return false;
  if (A === B || A.includes(B) || B.includes(A)) return true;
  const firstA = A.split(/[\s,]+/)[0];
  const firstB = B.split(/[\s,]+/)[0];
  return !!firstA && firstA === firstB;
}

/**
 * Merge the deterministic profile with the LLM's tailored content into the
 * final résumé. Name/contact/education and every role's title/company/dates
 * come from the parser verbatim; headline/summary/skills and each role's
 * bullets come from `tailored`. Bullets are matched to roles by index, falling
 * back to a company match, then to the role's own source bullets — so every
 * real role always renders with real bullets and never goes empty.
 */
export function assembleResume(profile: ParsedProfile, tailored: TailoredContent): TailoredResume {
  const tExp = Array.isArray(tailored.experience) ? tailored.experience : [];
  const experience: ResumeExperience[] = profile.experience.map((r, i) => {
    let bullets = tExp[i]?.bullets;
    if (!tExp[i] || !companyMatches(tExp[i].company ?? "", r.company)) {
      const matched = tExp.find((t) => companyMatches(t.company ?? "", r.company));
      if (matched) bullets = matched.bullets;
    }
    if (!Array.isArray(bullets) || bullets.length === 0) bullets = r.sourceBullets;
    return { role: r.role, company: r.company, dates: r.dates, bullets };
  });
  return {
    name: profile.name,
    contact: profile.contact,
    headline: tailored.headline,
    summary: tailored.summary,
    skills: tailored.skills,
    experience,
    education: profile.education,
  };
}
