// dashboard/lib/rolefit/resumeClient.ts
import { RESUME_JSON_SCHEMA, buildResumePrompt, type TailoredResume } from "@/lib/rolefit/resumeSchema";
import { callOpenRouterStructured } from "@/lib/rolefit/openrouterClient";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";

export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredResume> {
  const { system, user } = buildResumePrompt({ resumeText: args.resumeText, job: args.job });
  return callOpenRouterStructured<TailoredResume>({
    generationName: "resume-generation",
    label: "résumé",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: RESUME_JSON_SCHEMA,
    maxTokens: 4000,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const parsed = raw as TailoredResume;
      if (!parsed.name || !Array.isArray(parsed.experience)) {
        throw new Error("OpenRouter résumé missing required fields");
      }
      return parsed;
    },
  });
}
