import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserId } from "@/lib/auth";
import { getProfile, getJobForResume } from "@/lib/queries";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { createClient } from "@/lib/supabase/server";
import { tracingEnabled } from "@/lib/observability";
import { langfuseSpanProcessor } from "@/instrumentation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });

  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForResume(jobId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  // Prefer the uploaded PDF (rich layout → better deterministic parse). Any
  // failure falls back to the stored résumé text — never block generation.
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

  const run = async () => {
    const resume = await generateResume({
      resumeText: profile.resume_text!,
      pdfBytes,
      job: { title: job.title, company: job.company_name, description: job.description },
      model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
      apiKey,
    });
    return Response.json(resume);
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
