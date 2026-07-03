import {
  ENGLISH_ONLY_INSTRUCTION,
  NO_FABRICATION_INSTRUCTION,
  untrustedJobDescriptionBlock,
} from "@/lib/rolefit/promptPolicy";

export interface TailoredCoverLetter {
  greeting: string;       // e.g. "Dear Hiring Manager,"
  paragraphs: string[];   // 3-4 short body paragraphs
  closing: string;        // e.g. "Sincerely,"
  signature: string;      // candidate name
}

// OpenRouter (OpenAI-compatible) structured-output schema.
export const COVER_LETTER_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "tailored_cover_letter",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["greeting", "paragraphs", "closing", "signature"],
      properties: {
        greeting: { type: "string" },
        paragraphs: { type: "array", items: { type: "string" } },
        closing: { type: "string" },
        signature: { type: "string" },
      },
    },
  },
} as const;

export interface CoverLetterJob {
  title: string;
  company: string;
  description: string | null;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skillGaps: string[];
  redFlags: string[];
}

export function buildCoverLetterPrompt(args: {
  resumeText: string;
  candidateName: string | null;
  instructions: string | null;
  job: CoverLetterJob;
}): { system: string; user: string } {
  const system =
    "You are a professional cover-letter writer. Write a concise, specific, and " +
    "genuine cover letter that connects the candidate's real experience to the " +
    "target role and the company's mission. Specific beats generic: the letter's " +
    "strength comes from concrete, REAL details drawn from the candidate's " +
    "background — never from boilerplate, and never from invention.\n\n" +
    "GROUND RULES — never violate:\n" +
    `- ${NO_FABRICATION_INSTRUCTION}\n` +
    "- Never invent employers, titles, dates, degrees, certifications, metrics, " +
    "projects, or anecdotes. Name a technology, tool, or method only if the " +
    "background shows the candidate used it — never echo one from the posting " +
    "that the background does not support.\n" +
    "- The key requirements are each marked MET or NOT MET against the " +
    "candidate's background. Claim — or imply — that the candidate satisfies a " +
    "requirement ONLY if it is marked MET. Do not enumerate NOT MET requirements " +
    "or gaps as weaknesses; lean on adjacent, transferable strengths the " +
    "background genuinely supports.\n" +
    "- Never claim industry or domain experience the background does not show. " +
    "Genuine interest in the company's domain is welcome — expressed as " +
    "interest, not experience.\n" +
    "- Enthusiasm and motivation are yours to write freely — they need no " +
    "evidence — but every specific factual claim (a technology, metric, " +
    "project, employer, domain, or requirement met) must trace to the " +
    "background.\n" +
    '- Address the greeting generically (e.g. "Dear Hiring Manager,") unless ' +
    "the posting names a contact, and sign with the candidate's real name " +
    "exactly as supplied — never an invented one.\n\n" +
    "Keep it to 3-4 short body paragraphs. Return only the structured cover " +
    "letter.\n\n" +
    ENGLISH_ONLY_INSTRUCTION;

  const reqLines = args.job.requirements.length
    ? args.job.requirements.map((r) => `- [${r.met ? "MET" : "NOT MET"}] ${r.text}`).join("\n")
    : "(none provided)";
  const gapsBlock = args.job.skillGaps.length
    ? `\nKNOWN GAPS (do not highlight; emphasize transferable strengths instead):\n` +
      args.job.skillGaps.map((g) => `- ${g}`).join("\n") + "\n"
    : "";
  // Reviewer red flags are internal fit notes — give the model the context so it
  // avoids tone-deaf claims, but instruct it never to quote or dwell on them.
  const notesBlock = args.job.redFlags.length
    ? `\nINTERNAL REVIEW NOTES (context only — never quote or apologize for these):\n` +
      args.job.redFlags.map((f) => `- ${f}`).join("\n") + "\n"
    : "";
  const focusBlock = args.instructions
    ? `\nCANDIDATE FOCUS / AVOID:\n${args.instructions}\n`
    : "";

  const user =
    `TARGET ROLE: ${args.job.title} at ${args.job.company}\n` +
    (args.candidateName ? `CANDIDATE NAME: ${args.candidateName}\n` : "") +
    `\n${untrustedJobDescriptionBlock(args.job.description)}\n` +
    `\nABOUT THE COMPANY:\n${args.job.about ?? "(none provided)"}\n` +
    `\nKEY REQUIREMENTS (assessed against the candidate's background — only claim those marked MET):\n${reqLines}\n` +
    gapsBlock +
    notesBlock +
    focusBlock +
    `\nCANDIDATE RÉSUMÉ / BACKGROUND:\n${args.resumeText}`;
  return { system, user };
}
