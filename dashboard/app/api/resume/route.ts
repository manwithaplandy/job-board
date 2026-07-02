import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForResume, upsertApplicationPackage } from "@/lib/queries";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const [profile, job] = await Promise.all([getProfile(userId), getJobForResume(jobId)]);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  const { resumeText, pdfBytes } = await getResumeSource(profile);

  const run = async () => {
    try {
      const resume = await generateResume({
        resumeText,
        pdfBytes,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
      });
      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
      });
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
    const processor = langfuseSpanProcessor;
    if (processor) after(async () => { await processor.forceFlush(); });
    return res;
  }
  return await run();
}
