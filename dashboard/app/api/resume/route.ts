import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserClaims } from "@/lib/auth";
import { getProfile, getJobForResume, upsertApplicationPackage } from "@/lib/queries";
import { gateRejectionBody } from "@/lib/gateRejection";
import { reserveGenerations, refundGenerations } from "@/lib/usage";
import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
import { generationFailureMessage } from "@/lib/rolefit/generationFailureMessage";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { tracingEnabled, flushLangfuseTraces } from "@/lib/observability";

export const dynamic = "force-dynamic";
// Vercel Pro ceiling. The 202 response returns in milliseconds; the budget covers
// the background `after()` work: 2 LLM attempts × 120s + backoff ≈ 242s (see
// PER_ATTEMPT_TIMEOUT_MS in lib/rolefit/openrouterClient.ts).
export const maxDuration = 300;

// Async contract: everything the user must hear about IMMEDIATELY — auth,
// validation, config, and the allowance gate — stays synchronous (401/400/422/
// 404/500/402/429 exactly as before), then the route records a 'pending'
// generation_jobs row and returns 202. The LLM work, persist, and status write
// run in `after()`; the client polls GET /api/generations and toasts completion.
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to generate a résumé" }, { status: 401 });
  const userId = claims.id;

  const { jobId, instructions: rawInstructions } =
    (await req.json().catch(() => ({}))) as { jobId?: string; instructions?: unknown };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  // Per-job generation instructions ride the generate request (the sole instruction
  // source — profile.instructions is reviewer-only and no longer reaches generation).
  const norm = normalizeInstructions(rawInstructions, "résumé");
  if (!norm.ok) return Response.json({ error: norm.error }, { status: 400 });
  const instructions = norm.value;

  const [profile, job] = await Promise.all([getProfile(userId), getJobForResume(jobId, userId)]);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "résumé generation not configured" }, { status: 500 });

  const { resumeText } = getResumeSource(profile);

  // Tier gate: no plan → 402, monthly allowance exhausted → 429. reserveGenerations
  // ATOMICALLY charges the slot up front (avoids the check-then-charge TOCTOU); the
  // background catch below REFUNDS on a failed generation so a failure never burns
  // allowance. Placed AFTER the 404/422/500 validation so we never charge a request
  // that can't generate.
  const gate = await reserveGenerations(userId, claims.email, ["resume"]);
  if (!gate.ok) return Response.json(gateRejectionBody(gate), { status: gate.status });

  // Pending tracking row — created AFTER the reserve, so a pending row always
  // corresponds to a charged slot. A concurrent duplicate converges on the
  // existing pending row: refund THIS request's extra reservation and 202
  // idempotently without starting a second background generation.
  let tracked;
  try {
    tracked = await createGenerationJob(userId, jobId, "resume");
  } catch (e) {
    await refundGenerations(userId, ["resume"]);
    console.error("resume generation tracking failed", {
      userId, jobId, error: e instanceof Error ? e.message : String(e),
    });
    return Response.json({ error: "Generation couldn’t start — try again." }, { status: 502 });
  }
  const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
  if (!tracked.created) {
    await refundGenerations(userId, ["resume"]);
    return Response.json({ generation }, { status: 202 });
  }
  const generationJobId = tracked.job.id;

  // Status writes never throw out of the background callback: a failed write is
  // logged and the row stays 'pending' for the staleness sweep — it must not
  // trigger the catch's refund after a generation that actually succeeded.
  const settle = (outcome: { status: "ready" | "failed"; error?: string | null }) =>
    settleGenerationJob(userId, generationJobId, outcome).catch((e) => {
      console.error("resume generation status write failed", {
        userId, jobId, generationJobId, error: e instanceof Error ? e.message : String(e),
      });
    });

  const run = async () => {
    try {
      // The parent `resume` span (and its trace-level generated_at) now lives in
      // generateResume; the route just captures the trace id for the golden-dataset join.
      const { resume, traceId } = await generateResume({
        resumeText,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
        instructions,
        profileInstructions: profile.resume_generation_instructions,
      });

      await upsertApplicationPackage(userId, jobId, {
        resume,
        coverLetter: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
        resumeInstructions: instructions,
        profileVersion: profile.profile_version,
      });
      // The slot was reserved (charged) up front; a success keeps it.
      await settle({ status: "ready" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Surface the real cause in the Vercel runtime logs — the stored message is
      // user-safe copy only, so without this the actual failure (truncation /
      // timeout / upstream status) is invisible outside Langfuse.
      console.error("resume generation failed", {
        userId, jobId, model: profile.model_resume ?? DEFAULT_RESUME_MODEL, error: msg,
      });
      // Reserved-but-failed: refund so a failed generation never burns allowance.
      // Refund BEFORE the status write — if we crash between the two, the row is
      // still 'pending' and the staleness sweep fails it, but the money is back.
      await refundGenerations(userId, ["resume"]);
      await settle({ status: "failed", error: generationFailureMessage("Résumé", msg) });
    }
  };

  after(async () => {
    if (tracingEnabled()) {
      await propagateAttributes({ userId, sessionId: jobId }, run);
      // Flush inside the after() callback, which keeps the invocation alive until
      // it resolves — the old inline pre-response flush no longer applies.
      await flushLangfuseTraces();
    } else {
      await run();
    }
  });

  return Response.json({ generation }, { status: 202 });
}
