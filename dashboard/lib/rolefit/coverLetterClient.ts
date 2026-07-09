// dashboard/lib/rolefit/coverLetterClient.ts
import {
  COVER_LETTER_JSON_SCHEMA, buildCoverLetterPrompt,
  type CoverLetterJob, type TailoredCoverLetter,
} from "@/lib/rolefit/coverLetterSchema";
import { callOpenRouterStructured, REASONING_SAFE_MAX_TOKENS } from "@/lib/rolefit/openrouterClient";
import { parseTailoredCoverLetter } from "@/lib/rolefit/packageCodec";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_COVER_MODEL = "anthropic/claude-haiku-4.5";

export async function generateCoverLetter(args: {
  resumeText: string;
  candidateName: string | null;
  instructions: string | null;
  profileInstructions?: string | null;
  job: CoverLetterJob;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ letter: TailoredCoverLetter; traceId: string | null }> {
  const { system, user } = buildCoverLetterPrompt({
    resumeText: args.resumeText,
    candidateName: args.candidateName,
    instructions: args.instructions,
    profileInstructions: args.profileInstructions ?? null,
    job: args.job,
  });
  const runGeneration = () => callOpenRouterStructured<TailoredCoverLetter>({
    generationName: "cover-letter-generation",
    label: "cover letter",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: COVER_LETTER_JSON_SCHEMA,
    maxTokens: REASONING_SAFE_MAX_TOKENS,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const parsed = parseTailoredCoverLetter(raw);
      // parseTailoredCoverLetter is shape-only (accepts ""), but composeCoverLetterText
      // and the PDF writer use greeting/closing/signature unconditionally, so a model
      // that omits them must fail here rather than surface a blank line in the copied
      // text / PDF / preview.
      if (!parsed || !parsed.greeting || !parsed.closing || !parsed.signature) {
        throw new Error("OpenRouter cover letter missing required fields");
      }
      return parsed;
    },
  });

  // Mirror the résumé `resume` span: one `cover-letter` parent span defined here so
  // BOTH the standalone cover-letter route AND the prepare route's cover-letter leg
  // get it with no route edits. propagateAttributes stamps a trace-level
  // `generated_at` (updateActiveTrace does not exist in @langfuse/tracing).
  if (!tracingEnabled()) return { letter: await runGeneration(), traceId: null };
  return startActiveObservation("cover-letter", (span) => {
    span.update({ input: { title: args.job.title, company: args.job.company, description: args.job.description, background: args.resumeText } });
    return propagateAttributes({ metadata: { generated_at: new Date().toISOString() } }, async () => {
      const letter = await runGeneration();
      span.update({ output: composeCoverLetterText(letter) });
      return { letter, traceId: span.traceId };
    });
  }, { asType: "span" });
}
