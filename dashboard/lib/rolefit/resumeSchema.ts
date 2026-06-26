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
  const system =
    "You are a professional résumé writer. Tailor the candidate's real " +
    "experience to the target role. Emphasize genuinely relevant skills and " +
    "achievements; never invent employers, titles, dates, or credentials the " +
    "candidate does not have. Return only the structured résumé.";
  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n\n` +
    `JOB DESCRIPTION:\n${args.job.description ?? "(none provided)"}\n\n` +
    `CANDIDATE RÉSUMÉ / BACKGROUND:\n${args.resumeText}`;
  return { system, user };
}
