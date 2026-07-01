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
import { createClient } from "@/lib/supabase/server";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// "Prepare application": build the persisted package once (résumé + cover letter +
// answers snapshot, and — Greenhouse only — the real question schema + LLM-prefilled
// answers) and upsert it. The board loads the saved package instead of regenerating.
// Mirrors /api/resume + /api/cover-letter: a fetch() POST wants a clean JSON error,
// not requireUserId's redirect to /login (which the client would receive as HTML).
// Uses Promise.allSettled so a failure in one LLM leg doesn't block the others.
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

  // Download the candidate's PDF résumé once (shared by both résumé + prepare legs).
  let pdfBytes: Uint8Array | null = null;
  if (profile.resume_file_path) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.storage.from("resumes").download(profile.resume_file_path);
      if (error || !data) {
        console.error("résumé PDF download failed:", error?.message ?? "no data returned");
      } else {
        pdfBytes = new Uint8Array(await data.arrayBuffer());
      }
    } catch (e) {
      console.error("résumé PDF download error:", e);
    }
  }

  // Greenhouse-only side-quest: fetch the posting's real question schema, then
  // prefill the answerable (non-file) questions. It depends only on profile/job
  // data — NOT the generated résumé/cover — so it overlaps them in the Promise.allSettled
  // below instead of running afterward. fetchGreenhouseQuestions never throws (it
  // degrades to null), and the prefill round-trip is caught, so a Greenhouse/LLM
  // hiccup still persists a usable generic package and never fails the prepare.
  const greenhousePrefill = async (): Promise<{
    greenhouseQuestions: GreenhouseQuestions | null;
    prefilledAnswers: PrefilledAnswer[] | null;
  }> => {
    if (job.ats !== "greenhouse") return { greenhouseQuestions: null, prefilledAnswers: null };
    const greenhouseQuestions = await fetchGreenhouseQuestions({
      token: job.company_token,
      externalId: job.external_id,
    });
    if (!greenhouseQuestions) return { greenhouseQuestions: null, prefilledAnswers: null };
    const questions = toPrefillQuestions(greenhouseQuestions);
    if (questions.length === 0) return { greenhouseQuestions, prefilledAnswers: null };
    try {
      const prefilledAnswers = await generatePrefilledAnswers({
        resumeText,
        instructions: profile.instructions ?? null,
        answers,
        job: { title: job.title, company: job.company_name, description: job.description },
        questions,
        model: DEFAULT_PREFILL_MODEL,
        apiKey,
      });
      return { greenhouseQuestions, prefilledAnswers };
    } catch (e) {
      // Best-effort: keep the question list, drop the suggested answers.
      console.error("greenhouse prefill failed", e);
      return { greenhouseQuestions, prefilledAnswers: null };
    }
  };

  const run = async () => {
    // Résumé, cover letter, and the Greenhouse prefill are independent round-trips.
    // Use allSettled so a failure in one leg doesn't block the others — persist
    // whatever succeeded.
    const [resumeResult, coverResult, ghResult] = await Promise.allSettled([
      generateResume({
        resumeText,
        pdfBytes,
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
      greenhousePrefill(),
    ]);

    const resume: TailoredResume | null = resumeResult.status === "fulfilled" ? resumeResult.value : null;
    const coverLetter: TailoredCoverLetter | null = coverResult.status === "fulfilled" ? coverResult.value : null;
    const gh = ghResult.status === "fulfilled"
      ? ghResult.value
      : { greenhouseQuestions: null, prefilledAnswers: null };

    if (resumeResult.status === "rejected") console.error("resume generation failed", resumeResult.reason);
    if (coverResult.status === "rejected") console.error("cover letter generation failed", coverResult.reason);

    const pkg = await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      answersSnapshot: answers,
      greenhouseQuestions: gh.greenhouseQuestions,
      prefilledAnswers: gh.prefilledAnswers,
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
