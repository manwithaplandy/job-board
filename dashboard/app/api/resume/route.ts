import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { getUserClaims } from "@/lib/auth";
import { getProfile, getJobForResume, upsertApplicationPackage } from "@/lib/queries";
import { checkGenerationAllowance, chargeGenerations } from "@/lib/usage";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { tracingEnabled, flushLangfuseTraces } from "@/lib/observability";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { ResumeChecks } from "@/lib/rolefit/resumeChecks";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });
  const userId = claims.id;

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  // Tier gate BEFORE any LLM call: no plan → 402, monthly allowance exhausted → 429.
  const gate = await checkGenerationAllowance(userId, claims.email, ["resume"]);
  if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status });

  const [profile, job] = await Promise.all([getProfile(userId), getJobForResume(jobId, userId)]);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  const { resumeText } = getResumeSource(profile);

  const run = async () => {
    try {
      let traceId: string | null = null;
      const generate = async (): Promise<{ resume: TailoredResume; checks: ResumeChecks }> =>
        generateResume({
          resumeText,
          job: { title: job.title, company: job.company_name, description: job.description },
          model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
          apiKey,
        });

      let result: { resume: TailoredResume; checks: ResumeChecks };
      if (tracingEnabled()) {
        // Parent `resume` observation: clean input/output the managed judge targets,
        // and the trace whose id links human scores to judge scores. The nested
        // `resume-generation` span records inside this active trace.
        result = await startActiveObservation(
          "resume",
          async (span) => {
            traceId = span.traceId;
            span.update({
              // `background` is the candidate's real source résumé — the grounding
              // truth the judge compares generated claims against ({{candidate_background}}).
              input: { title: job.title, company: job.company_name, description: job.description, background: resumeText },
            });
            const r = await generate();
            span.update({
              output: composeResumeText(r.resume),
              metadata: { mechanical_checks: r.checks },
            });
            return r;
          },
          { asType: "span" },
        );
      } else {
        result = await generate();
      }

      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: result.resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
        profileVersion: profile.profile_version,
      });
      // Charge only after a successful generation+persist — a failed generation
      // (caught below) never burns allowance.
      await chargeGenerations(userId, ["resume"]);
      return Response.json({ package: pkg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("truncated")) return Response.json({ error: "Résumé generation truncated — try again with a shorter résumé." }, { status: 502 });
      if (msg.includes("429") || msg.includes("rate")) return Response.json({ error: "Rate limited — try again in a moment." }, { status: 429 });
      if (msg.includes("402")) return Response.json({ error: "Insufficient credits." }, { status: 502 });
      return Response.json({ error: "Generation failed — try again." }, { status: 502 });
    }
  };

  if (tracingEnabled()) {
    const res = await propagateAttributes({ userId, sessionId: jobId }, run);
    // Flush inline while the invocation is still alive — a post-response after()
    // callback can lose the race against Vercel freezing the instance.
    await flushLangfuseTraces();
    return res;
  }
  return await run();
}
