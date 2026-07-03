import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForCoverLetter, upsertApplicationPackage } from "@/lib/queries";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { tracingEnabled, flushLangfuseTraces } from "@/lib/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  // Mirrors /api/resume: a fetch() POST wants a clean 401 JSON, not requireUserId's
  // redirect to /login (which the client would receive as HTML).
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a cover letter" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const [profile, job] = await Promise.all([getProfile(userId), getJobForCoverLetter(jobId, userId)]);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "cover letter generation not configured" }, { status: 500 });

  const run = async () => {
    try {
      const letter = await generateCoverLetter({
        resumeText: profile.resume_text!,
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
      });
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: null,
        coverLetter: letter,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
      });
      return Response.json({ package: pkg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("truncated")) return Response.json({ error: "Cover letter generation truncated — try again with a shorter résumé." }, { status: 502 });
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
