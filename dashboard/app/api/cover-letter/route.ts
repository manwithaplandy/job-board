import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserClaims } from "@/lib/auth";
import { getProfile, getJobForCoverLetter, upsertApplicationPackage } from "@/lib/queries";
import { gateRejectionBody } from "@/lib/gateRejection";
import { reserveGenerations, refundGenerations } from "@/lib/usage";
import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
import { generationFailureMessage } from "@/lib/rolefit/generationFailureMessage";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
import { getStructuredModels } from "@/lib/openrouter";
import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
import { tracingEnabled, ensureTracingStarted, flushLangfuseTraces } from "@/lib/observability";

export const dynamic = "force-dynamic";
// Vercel Pro ceiling. The 202 response returns in milliseconds; the budget covers
// the background `after()` work: 2 LLM attempts × 120s + backoff ≈ 242s (see
// PER_ATTEMPT_TIMEOUT_MS in lib/rolefit/openrouterClient.ts).
export const maxDuration = 300;

// Mirrors /api/resume, including its async contract: auth/validation/config/gate
// stay synchronous (a fetch() POST wants a clean 401 JSON, not requireUserId's
// redirect to /login), then a 'pending' generation_jobs row is recorded and the
// route returns 202. The LLM work, persist, and status write run in `after()`;
// the client polls GET /api/generations and toasts completion.
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to generate a cover letter" }, { status: 401 });
  const userId = claims.id;

  const { jobId, instructions: rawInstructions } =
    (await req.json().catch(() => ({}))) as { jobId?: string; instructions?: unknown };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  // Per-job generation instructions ride the generate request (the sole instruction
  // source — profile.instructions is reviewer-only and no longer reaches generation).
  const norm = normalizeInstructions(rawInstructions, "cover letter");
  if (!norm.ok) return Response.json({ error: norm.error }, { status: 400 });
  const instructions = norm.value;

  const [profile, job] = await Promise.all([getProfile(userId), getJobForCoverLetter(jobId, userId)]);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "cover letter generation not configured" }, { status: 500 });

  const model = profile.model_cover ?? DEFAULT_COVER_MODEL;

  // Tier gate: no plan → 402, exhausted → 429. reserveGenerations ATOMICALLY charges the
  // slot up front (avoids check-then-charge TOCTOU); the background catch refunds on
  // failure so a failed generation never burns allowance. After the 404/422/500
  // validation so we never charge a request that can't generate. The catalog is fetched
  // CONCURRENTLY with the gate; getStructuredModels is 1h-cached and returns [] (fail-open)
  // on failure, so it adds no new rejection path even on the reject path.
  const [gate, catalog] = await Promise.all([
    reserveGenerations(userId, claims.email, ["cover"]),
    getStructuredModels(),
  ]);
  if (!gate.ok) return Response.json(gateRejectionBody(gate), { status: gate.status });

  // Resolve the reasoning setting from the gate's OWN plan snapshot (the same
  // authoritative plan the charge used — no second getViewerPlan lookup): clamp to the
  // tier, and OMIT the param (null) for models that can't take it.
  const reasoningEffort = resolveReasoningSetting(
    gate.plan, profile.reasoning_effort_cover, model, catalog,
  );

  // Pending tracking row — created AFTER the reserve, so a pending row always
  // corresponds to a charged slot. A concurrent duplicate converges on the
  // existing pending row: refund THIS request's extra reservation and 202
  // idempotently without starting a second background generation.
  let tracked;
  try {
    tracked = await createGenerationJob(userId, jobId, "cover");
  } catch (e) {
    await refundGenerations(userId, ["cover"]);
    console.error("cover letter generation tracking failed", {
      userId, jobId, error: e instanceof Error ? e.message : String(e),
    });
    return Response.json({ error: "Generation couldn’t start — try again." }, { status: 502 });
  }
  const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
  if (!tracked.created) {
    await refundGenerations(userId, ["cover"]);
    return Response.json({ generation }, { status: 202 });
  }
  const generationJobId = tracked.job.id;

  // Status writes never throw out of the background callback: a failed write is
  // logged and the row stays 'pending' for the staleness sweep — it must not
  // trigger the catch's refund after a generation that actually succeeded.
  const settle = (outcome: { status: "ready" | "failed"; error?: string | null }) =>
    settleGenerationJob(userId, generationJobId, outcome).catch((e) => {
      console.error("cover letter generation status write failed", {
        userId, jobId, generationJobId, error: e instanceof Error ? e.message : String(e),
      });
    });

  const run = async () => {
    try {
      const { letter, traceId } = await generateCoverLetter({
        resumeText: profile.resume_text!,
        candidateName: profile.full_name ?? null,
        instructions,
        profileInstructions: profile.cover_letter_generation_instructions,
        job: {
          title: job.title,
          company: job.company_name,
          description: job.description,
          about: job.about,
          requirements: job.requirements,
          skillGaps: job.skill_gaps,
          redFlags: job.red_flags,
        },
        model,
        reasoningEffort,
        apiKey,
      });
      await upsertApplicationPackage(userId, jobId, {
        resume: null,
        coverLetter: letter,
        prefilledAnswers: null,
        applyUrl: null,
        coverLetterTraceId: traceId,
        coverLetterInstructions: instructions,
        // No résumé generated here, so no résumé provenance to record. upsert's
        // ON CONFLICT preserves the stored résumé + its profile_version untouched.
        profileVersion: null,
      });
      // The slot was reserved (charged) up front; a success keeps it.
      await settle({ status: "ready" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Surface the real cause in the Vercel runtime logs; the stored message is
      // user-safe copy only (mirrors /api/resume).
      console.error("cover letter generation failed", {
        userId, jobId, model, error: msg,
      });
      // Reserved-but-failed: refund so a failed generation never burns allowance.
      // Refund BEFORE the status write — if we crash between the two, the row is
      // still 'pending' and the staleness sweep fails it, but the money is back.
      await refundGenerations(userId, ["cover"]);
      await settle({ status: "failed", error: generationFailureMessage("Cover letter", msg) });
    }
  };

  after(async () => {
    if (tracingEnabled()) {
      // Init tracing BEFORE propagateAttributes: it wires the AsyncLocalStorage
      // context manager, and context.with() under the boot-time noop manager
      // would silently drop userId/sessionId from the first trace per instance.
      await ensureTracingStarted();
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
