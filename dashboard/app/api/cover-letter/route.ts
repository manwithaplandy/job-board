import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForCoverLetter } from "@/lib/queries";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Mirrors /api/resume: a fetch() POST wants a clean 401 JSON, not requireUserId's
  // redirect to /login (which the client would receive as HTML).
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a cover letter" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForCoverLetter(jobId, userId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "cover letter generation not configured" }, { status: 500 });

  const run = async () => {
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
    return Response.json(letter);
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
