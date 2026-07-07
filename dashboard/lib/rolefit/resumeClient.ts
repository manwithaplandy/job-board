// dashboard/lib/rolefit/resumeClient.ts
import {
  TAILORED_RESUME_SCHEMA,
  buildResumePrompt,
  assembleResume,
  type TailoredResume,
  type TailoredContent,
} from "@/lib/rolefit/resumeSchema";
import { parseProfileText, yearsOfExperience } from "@/lib/rolefit/parseProfile";
import { callOpenRouterStructured, REASONING_SAFE_MAX_TOKENS } from "@/lib/rolefit/openrouterClient";
import { resumeChecks, type ResumeChecks } from "@/lib/rolefit/resumeChecks";
import { parseTailoredResume } from "@/lib/rolefit/packageCodec";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";

export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ resume: TailoredResume; checks: ResumeChecks; traceId: string | null }> {
  // Deterministically extract the fixed fields; the LLM only tailors the rest,
  // and the OpenRouter transport (+ Langfuse generation span) is the shared helper.
  const profile = parseProfileText(args.resumeText);
  const tenureYears = yearsOfExperience(profile, Date.now());
  const { system, user } = buildResumePrompt({ profile, resumeText: args.resumeText, job: args.job, tenureYears });
  const callModel = () => callOpenRouterStructured<TailoredResume>({
    generationName: "resume-generation",
    label: "résumé",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: TAILORED_RESUME_SCHEMA,
    maxTokens: REASONING_SAFE_MAX_TOKENS,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const tailored = raw as TailoredContent;
      if (!tailored.headlineFocus || !Array.isArray(tailored.experience)) {
        throw new Error("OpenRouter résumé missing required fields");
      }
      const resume = assembleResume(profile, tailored, args.resumeText);
      if (!parseTailoredResume(resume)) {
        throw new Error("assembled résumé failed shape validation");
      }
      return resume;
    },
  });

  // Without tracing the parent `resume` span is skipped entirely — the nested
  // `resume-generation` generation still records if a processor is registered.
  if (!tracingEnabled()) {
    const resume = await callModel();
    return { resume, checks: resumeChecks(resume, profile), traceId: null };
  }

  // Parent `resume` observation: clean input/output the managed judge targets, and
  // the trace whose id links human scores to judge scores. Defined ONCE here so both
  // the /api/resume and /api/application/prepare routes share the identical span shape.
  // `generated_at` is stamped at trace level via propagateAttributes (this SDK has no
  // updateActiveTrace) so the golden-dataset join can order by generation time.
  return startActiveObservation(
    "resume",
    (span) => {
      span.update({
        // `background` is the candidate's real source résumé — the grounding truth
        // the judge compares generated claims against ({{candidate_background}}).
        input: { title: args.job.title, company: args.job.company, description: args.job.description, background: args.resumeText },
      });
      return propagateAttributes({ metadata: { generated_at: new Date().toISOString() } }, async () => {
        const resume = await callModel();
        const checks = resumeChecks(resume, profile);
        span.update({ output: composeResumeText(resume), metadata: { mechanical_checks: checks } });
        return { resume, checks, traceId: span.traceId };
      });
    },
    { asType: "span" },
  );
}
