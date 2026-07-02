// dashboard/lib/rolefit/coverLetterClient.ts
import {
  COVER_LETTER_JSON_SCHEMA, buildCoverLetterPrompt,
  type CoverLetterJob, type TailoredCoverLetter,
} from "@/lib/rolefit/coverLetterSchema";
import { callOpenRouterStructured } from "@/lib/rolefit/openrouterClient";
import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";

export const DEFAULT_COVER_MODEL = "anthropic/claude-haiku-4.5";

export async function generateCoverLetter(args: {
  resumeText: string;
  candidateName: string | null;
  instructions: string | null;
  job: CoverLetterJob;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredCoverLetter> {
  const { system, user } = buildCoverLetterPrompt({
    resumeText: args.resumeText,
    candidateName: args.candidateName,
    instructions: args.instructions,
    job: args.job,
  });
  return callOpenRouterStructured<TailoredCoverLetter>({
    generationName: "cover-letter-generation",
    label: "cover letter",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: COVER_LETTER_JSON_SCHEMA,
    maxTokens: 2000,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const parsed = parseTailoredCoverLetter(raw);
      if (!parsed || !parsed.greeting || !parsed.closing || !parsed.signature) {
        throw new Error("OpenRouter cover letter missing required fields");
      }
      return parsed;
    },
  });
}
