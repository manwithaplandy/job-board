import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForPackage, upsertApplicationPackage } from "@/lib/queries";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
import { fetchGreenhouseQuestions, type GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import { toPrefillQuestions, type PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";

export const dynamic = "force-dynamic";

// "Prepare application": build the persisted package once (résumé + cover letter +
// answers snapshot, and — Greenhouse only — the real question schema + LLM-prefilled
// answers) and upsert it. The board loads the saved package instead of regenerating.
// Mirrors /api/resume + /api/cover-letter: a fetch() POST wants a clean JSON error,
// not requireUserId's redirect to /login (which the client would receive as HTML).
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to prepare an application" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForPackage(jobId, userId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "application preparation not configured" }, { status: 500 });

  const resumeText = profile.resume_text!;
  const answers = applicationAnswersFromProfile(profile);

  const run = async () => {
    // Résumé + cover letter are the core deliverables — generate in parallel.
    const [resume, coverLetter] = await Promise.all([
      generateResume({
        resumeText,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
      }),
      generateCoverLetter({
        resumeText,
        candidateName: profile.full_name ?? null,
        instructions: profile.instructions ?? null,
        job: {
          title: job.title,
          company: job.company_name,
          description: job.description,
          about: job.about,
          requirements: job.requirements,
          skillGaps: job.skill_gaps,
          redFlags: job.red_flags,
        },
        model: profile.model_cover ?? DEFAULT_COVER_MODEL,
        apiKey,
      }),
    ]);

    // Greenhouse-only: fetch the posting's real question schema, then prefill the
    // answerable (non-file) questions. Each step degrades to null, so a usable
    // generic package is still persisted on any Greenhouse/LLM hiccup.
    let greenhouseQuestions: GreenhouseQuestions | null = null;
    let prefilledAnswers: PrefilledAnswer[] | null = null;
    if (job.ats === "greenhouse") {
      greenhouseQuestions = await fetchGreenhouseQuestions({
        token: job.company_token,
        externalId: job.external_id,
      });
      if (greenhouseQuestions) {
        const questions = toPrefillQuestions(greenhouseQuestions);
        if (questions.length > 0) {
          try {
            prefilledAnswers = await generatePrefilledAnswers({
              resumeText,
              instructions: profile.instructions ?? null,
              answers,
              job: { title: job.title, company: job.company_name, description: job.description },
              questions,
              model: DEFAULT_PREFILL_MODEL,
              apiKey,
            });
          } catch (e) {
            // Best-effort: keep the question list, drop the suggested answers.
            console.error("greenhouse prefill failed", e);
            prefilledAnswers = null;
          }
        }
      }
    }

    const pkg = await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      answersSnapshot: answers,
      greenhouseQuestions,
      prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
    });
    return Response.json(pkg);
  };

  try {
    if (tracingEnabled()) {
      const res = await propagateAttributes({ userId, sessionId: jobId }, run);
      const processor = langfuseSpanProcessor;
      if (processor) after(async () => { await processor.forceFlush(); });
      return res;
    }
    return await run();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
