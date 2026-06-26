import { getUserId } from "@/lib/auth";
import { getProfile, getJobForResume } from "@/lib/queries";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";

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

  try {
    const resume = await generateResume({
      resumeText: profile.resume_text,
      job: { title: job.title, company: job.company_name, description: job.description },
      model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
      apiKey,
    });
    return Response.json(resume);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
