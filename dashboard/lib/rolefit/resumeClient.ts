// dashboard/lib/rolefit/resumeClient.ts
import {
  TAILORED_RESUME_SCHEMA,
  buildResumePrompt,
  assembleResume,
  type TailoredResume,
  type TailoredContent,
} from "@/lib/rolefit/resumeSchema";
import { parseProfileText, yearsOfExperience } from "@/lib/rolefit/parseProfile";
import { callOpenRouterStructured } from "@/lib/rolefit/openrouterClient";
import { resumeChecks, type ResumeChecks } from "@/lib/rolefit/resumeChecks";
import { parseTailoredResume } from "@/lib/rolefit/packageCodec";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";

export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ resume: TailoredResume; checks: ResumeChecks }> {
  // Deterministically extract the fixed fields; the LLM only tailors the rest,
  // and the OpenRouter transport (+ Langfuse generation span) is the shared helper.
  const profile = parseProfileText(args.resumeText);
  const tenureYears = yearsOfExperience(profile, Date.now());
  const { system, user } = buildResumePrompt({ profile, resumeText: args.resumeText, job: args.job, tenureYears });
  const resume = await callOpenRouterStructured<TailoredResume>({
    generationName: "resume-generation",
    label: "résumé",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: TAILORED_RESUME_SCHEMA,
    maxTokens: 4000,
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
  return { resume, checks: resumeChecks(resume, profile) };
}
