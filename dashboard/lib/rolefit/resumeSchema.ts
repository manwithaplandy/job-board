export interface ResumeExperience {
  role: string; company: string; dates: string; bullets: string[];
}
export interface TailoredResume {
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: string;
}

// OpenRouter (OpenAI-compatible) structured-output schema.
export const RESUME_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "tailored_resume",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "headline", "summary", "skills", "experience", "education"],
      properties: {
        name: { type: "string" },
        headline: { type: "string" },
        summary: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        experience: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "company", "dates", "bullets"],
            properties: {
              role: { type: "string" },
              company: { type: "string" },
              dates: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
            },
          },
        },
        education: { type: "string" },
      },
    },
  },
} as const;

export function buildResumePrompt(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
}): { system: string; user: string } {
  const system = `You are an expert résumé writer. You turn a candidate's REAL background into a sharp, single-page résumé tailored to one specific role. Your JSON output is rendered directly into a professional PDF, so it must be clean, consistent, and tight.

GROUND RULES — never violate:
- Use only facts present in the candidate's background. Never invent or inflate employers, titles, dates, degrees, certifications, metrics, or technologies. If a detail is missing, omit it — do not guess or estimate.
- Keep every number, date, and proper noun internally consistent. The same achievement must carry the same figure wherever it appears (e.g. never "10,000 users" in the summary but "1,000 users" in a bullet).
- Write clean, professional American English. Proofread spelling, capitalization, and spacing; never emit truncated or garbled words.

TAILORING — the actual craft:
- Tailor by SELECTION and EMPHASIS, not narration. Surface the experience, skills, and metrics most relevant to the target role; compress or drop the rest.
- Do NOT explain why something is relevant. Ban phrases like "directly analogous to…", "a pattern applicable to…", "demonstrating…", and "which is relevant because…". State the accomplishment and let it stand — the reader infers relevance.
- Where the candidate genuinely matches the job description, mirror its terminology: use the role's own words for skills the candidate actually has.

LENGTH — the result MUST fit on one US-Letter page:
- headline: one line, ≤90 characters. Professional identity angled toward the role. No employer names, no "tailored for".
- summary: 2–3 sentences, ≤55 words total. Lead with seniority and domain, then the one or two most role-relevant, quantified strengths.
- skills: 8–14 of the most relevant items, ordered by relevance. Concrete tools and competencies — no soft-skill filler.
- experience: the 3–4 most relevant roles, most recent first. Give older or less-relevant roles fewer bullets, or omit them. Never alter a role's title, company, or dates.
- bullets: 3–4 for recent roles, 1–2 for older ones. Each ≤22 words (one to two lines). Open with a strong past-tense verb, lead with the outcome, quantify it with the candidate's real metrics, and name the key technologies. One idea per bullet.
- education: one concise line (degree, institution, status if given). No coursework padding.

STYLE:
- Active voice, past tense, no first-person pronouns. No buzzwords or clichés ("results-driven", "team player", "passionate"), no emojis, no filler.

Return only the structured résumé defined by the schema — no extra fields, notes, or commentary.`;
  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n\n` +
    `JOB DESCRIPTION:\n${args.job.description ?? "(none provided)"}\n\n` +
    `CANDIDATE RÉSUMÉ / BACKGROUND:\n${args.resumeText}\n\n` +
    `Write a single-page résumé tailored to the target role above, drawing only on the candidate's background. Follow every rule in your instructions.`;
  return { system, user };
}
