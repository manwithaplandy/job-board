import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getUserClaims } from "@/lib/auth";
import { getProfile, getJobForPackage, getJobQuestion, upsertApplicationPackage } from "@/lib/queries";
import { gateRejectionBody } from "@/lib/gateRejection";
import { reserveGenerations, refundGenerations, type GenerationKind } from "@/lib/usage";
import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
import { fetchGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "@/lib/rolefit/coverLetterQuestion";
import { toPrefillQuestions, type PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
import { tracingEnabled, flushLangfuseTraces } from "@/lib/observability";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

export const dynamic = "force-dynamic";
// Vercel Pro ceiling for the background `after()` work (the 202 returns in ms). The
// legs run SEQUENTIALLY, not overlapped: the résumé leg first, then a bounded prefill
// chained on the generated résumé. Worst-case arithmetic must stay under this 300s:
//   résumé leg  ≤ 2×120s + ~2s backoff ≈ 242s   (openrouterClient.ts: MAX_ATTEMPTS=2,
//                                                 PER_ATTEMPT_TIMEOUT_MS=120000)
//   prefill leg ≤ PREFILL_TIMEOUT_MS + ~2s backoff ≈ 47s (shared AbortSignal below)
//   persistence   (upsert + settle)              ≈ a few seconds
//   total       ≈ 242 + 47 + persistence < 300s  (~10s margin)
// The cover leg (when the posting asks) runs in parallel with the résumé and is dominated
// by it. Prefill is best-effort: if it caps out, the signal aborts it, the answers are
// dropped, and the résumé still persists.
export const maxDuration = 300;

// Hard ceiling on the prefill leg (best-effort). It runs AFTER the résumé, so this keeps
// résumé (≤242s) + prefill (≤~47s) + persistence under maxDuration=300 even when the
// résumé leg hits its worst case. Do NOT raise past ~45s without re-checking that budget.
const PREFILL_TIMEOUT_MS = 45_000;

// User-facing label is "Prefill application"; kind stays 'prepare' (see schema.sql).
//
// Greenhouse-ONLY: this builds the persisted package (résumé + LLM-prefilled answers
// drawn from the GENERATED résumé, and — when the posting asks — a cover letter) and
// upserts it. The button/API are Greenhouse-only because prefill needs the posting's
// real question schema; a non-Greenhouse job 400s before any charge.
//
// Async contract (mirrors /api/resume): auth/validation/config/gate stay synchronous,
// then ONE 'pending' generation_jobs row of kind='prepare' is recorded and the route
// returns 202. In `after()` the résumé leg runs first; on success it chains a bounded,
// best-effort prefill fed the generated résumé (a prefill failure is swallowed — the
// résumé still persists). The cover leg runs in parallel, ONLY when the posting asks
// for a cover letter (it's the only leg besides résumé that reserves allowance). The
// row settles 'ready' when the legs settle — with a user-safe partial note if a WANTED
// leg failed — and 'failed' only when nothing new persisted.
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to prefill an application" }, { status: 401 });
  const userId = claims.id;

  const { jobId, resumeInstructions: rawResumeInstr, coverLetterInstructions: rawCoverInstr } =
    (await req.json().catch(() => ({}))) as {
      jobId?: string; resumeInstructions?: unknown; coverLetterInstructions?: unknown;
    };
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  // Per-job instruction boxes → each leg's own instructions. Over-cap is a caller
  // error (400) rejected BEFORE the gate so a bad request never charges allowance.
  const resumeNorm = normalizeInstructions(rawResumeInstr, "résumé");
  if (!resumeNorm.ok) return Response.json({ error: resumeNorm.error }, { status: 400 });
  const coverNorm = normalizeInstructions(rawCoverInstr, "cover letter");
  if (!coverNorm.ok) return Response.json({ error: coverNorm.error }, { status: 400 });
  const resumeInstructions = resumeNorm.value;
  const coverLetterInstructions = coverNorm.value;

  const profile = await getProfile(userId);
  if (!profile?.resume_text) {
    return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
  }
  const job = await getJobForPackage(jobId, userId);
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });
  if (job.ats !== "greenhouse") {
    return Response.json({ error: "Prefill is available for Greenhouse postings only" }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "application prefill not configured" }, { status: 500 });

  // Poll-time question schema (shared). Fall back to an on-demand fetch for a brand-new
  // job not yet backfilled — used IN-MEMORY ONLY; the poller persists it later (this
  // route has shared_read access via getJobQuestion and never writes job_questions).
  let questions = await getJobQuestion(userId, jobId);
  if (questions == null) {
    // On-demand fallback runs in the SYNCHRONOUS prologue (before the 202), so a slow/hung
    // Greenhouse API would stall the user's click for minutes. Bound it to 8s via an
    // AbortSignal on fetchImpl → on timeout fetchGreenhouseQuestions swallows the abort and
    // returns null, degrading to a résumé-only reserve exactly as designed.
    questions = await fetchGreenhouseQuestions({
      token: job.company_token,
      externalId: job.external_id,
      fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    });
  }
  const wantsCover = hasCoverLetterQuestion(questions);

  // Always charge résumé; charge cover ONLY when the posting asks for one. reserveGenerations
  // is ATOMIC (avoids check-then-charge TOCTOU) and all-or-nothing across the kinds; a
  // rejected leg is REFUNDED below so it never burns allowance. After the 404/400/422/500
  // validation so we never charge a request that can't generate. No plan → 402, exhausted → 429.
  const kinds: GenerationKind[] = wantsCover ? ["resume", "cover"] : ["resume"];
  const gate = await reserveGenerations(userId, claims.email, kinds);
  if (!gate.ok) return Response.json(gateRejectionBody(gate), { status: gate.status });

  // Pending tracking row — created AFTER the reserve, so a pending row always
  // corresponds to charged slots. A concurrent duplicate converges on the existing
  // pending row: refund THIS request's extra reservations and 202 idempotently.
  let tracked;
  try {
    tracked = await createGenerationJob(userId, jobId, "prepare");
  } catch (e) {
    await refundGenerations(userId, kinds);
    console.error("application prepare tracking failed", {
      userId, jobId, error: e instanceof Error ? e.message : String(e),
    });
    return Response.json({ error: "Prefill couldn’t start — try again." }, { status: 502 });
  }
  const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
  if (!tracked.created) {
    await refundGenerations(userId, kinds);
    return Response.json({ generation }, { status: 202 });
  }
  const generationJobId = tracked.job.id;

  // Status writes never throw out of the background callback: a failed write is
  // logged and the row stays 'pending' for the staleness sweep — it must not
  // trigger the outer catch's refund after legs already settled.
  const settle = (outcome: { status: "ready" | "failed"; error?: string | null }) =>
    settleGenerationJob(userId, generationJobId, outcome).catch((e) => {
      console.error("application prepare status write failed", {
        userId, jobId, generationJobId, error: e instanceof Error ? e.message : String(e),
      });
    });

  const answers = applicationAnswersFromProfile(profile);
  // Résumé/cover source plaintext via the shared helper (the profile résumé). NOTE: prefill
  // does NOT use this — it feeds the freshly GENERATED résumé (composeResumeText below).
  const { resumeText } = getResumeSource(profile);
  // Prefill answers the answerable (non-file) questions MINUS any cover-letter question
  // (the cover leg writes that letter — prefill must not double-answer it).
  const prefillQuestions = toPrefillQuestions(stripCoverLetterQuestions(questions));

  const run = async () => {
    let resumeTraceId: string | null = null;
    let coverLetterTraceId: string | null = null;

    // Résumé leg → prefill chained on the GENERATED résumé. A résumé failure rejects the
    // whole leg (prefill skipped, retried together next time). A prefill failure is
    // swallowed (best-effort) so the résumé still persists.
    const resumeLeg = (async (): Promise<{ resume: TailoredResume; prefilled: PrefilledAnswer[] | null }> => {
      const { resume, traceId } = await generateResume({
        resumeText,
        instructions: resumeInstructions,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
        apiKey,
      });
      resumeTraceId = traceId;
      let prefilled: PrefilledAnswer[] | null = null;
      if (prefillQuestions.length > 0) {
        // Bound the prefill leg. It runs AFTER the résumé (sequential), so an unbounded
        // prefill stacks on top of the résumé's worst case (2×120s + backoff) and can blow
        // maxDuration. Create the deadline HERE — LAZILY, once the résumé has resolved —
        // NOT at module load, because AbortSignal.timeout starts counting immediately; a
        // deadline made before the ~242s résumé leg would already be expired and abort every
        // prefill. A single shared signal bounds the WHOLE leg across both openrouter attempts
        // (replacing the client's per-attempt 120s timeout with our tighter 45s). A capped-out
        // prefill throws → swallowed below (best-effort): the résumé still persists, no answers.
        const prefillDeadline = AbortSignal.timeout(PREFILL_TIMEOUT_MS);
        try {
          prefilled = await generatePrefilledAnswers({
            resumeText: composeResumeText(resume), // the tailored résumé, not profile text
            instructions: null,                    // prefill is instruction-less (spec)
            answers,
            job: { title: job.title, company: job.company_name, description: job.description },
            questions: prefillQuestions,
            model: DEFAULT_PREFILL_MODEL,
            apiKey,
            // Shared 45s deadline across retries → the leg can't run away sequentially.
            fetchImpl: (input, init) => fetch(input, { ...init, signal: prefillDeadline }),
          });
        } catch (e) {
          console.error("greenhouse prefill failed", e); // best-effort: keep the résumé
        }
      }
      return { resume, prefilled };
    })();

    // Cover leg — only when the posting asks. Independent of the résumé (uses profile text).
    // The sentinel rejection is consumed by Promise.allSettled → never an unhandled rejection.
    const coverLeg: Promise<TailoredCoverLetter> = wantsCover
      ? (async (): Promise<TailoredCoverLetter> => {
          const { letter, traceId } = await generateCoverLetter({
            resumeText,
            candidateName: profile.full_name ?? null,
            instructions: coverLetterInstructions,
            job: {
              title: job.title, company: job.company_name, description: job.description,
              about: job.about, requirements: job.requirements,
              skillGaps: job.skill_gaps, redFlags: job.red_flags,
            },
            model: profile.model_cover ?? DEFAULT_COVER_MODEL,
            apiKey,
          });
          coverLetterTraceId = traceId;
          return letter;
        })()
      : Promise.reject(new Error("no cover requested")); // sentinel; not counted as a failure

    const [resumeResult, coverResult] = await Promise.allSettled([resumeLeg, coverLeg]);

    const resume: TailoredResume | null = resumeResult.status === "fulfilled" ? resumeResult.value.resume : null;
    const prefilledAnswers: PrefilledAnswer[] | null =
      resumeResult.status === "fulfilled" ? resumeResult.value.prefilled : null;
    const coverLetter: TailoredCoverLetter | null = coverResult.status === "fulfilled" ? coverResult.value : null;

    if (resumeResult.status === "rejected") console.error("resume generation failed", resumeResult.reason);
    if (wantsCover && coverResult.status === "rejected") console.error("cover letter generation failed", coverResult.reason);

    await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
      resumeTraceId,
      coverLetterTraceId,
      resumeInstructions,
      coverLetterInstructions,
      profileVersion: profile.profile_version,
    });

    // Refund charged legs that failed. Cover is only charged (and only "failed") when wanted;
    // an unwanted cover leg is the sentinel rejection above and is never refunded. Both-fulfilled
    // refunds nothing. A whole-prepare failure throws before here and refunds `kinds` in the
    // outer catch. Model choice (model_resume/model_cover) is intentionally NOT tier-gated —
    // generation is 1–3% of cost (spec); the monthly counter is the abuse cap.
    const refundKinds: GenerationKind[] = [
      ...(resumeResult.status === "rejected" ? (["resume"] as const) : []),
      ...(wantsCover && coverResult.status === "rejected" ? (["cover"] as const) : []),
    ];
    if (refundKinds.length) await refundGenerations(userId, refundKinds);

    // Settle the tracked prepare. The client reloads the persisted package on 'ready' and
    // derives the pane states from its contents, so the row only distinguishes: clean
    // success, partial success (user-safe note in `error`), and nothing-generated. 'failed'
    // only when nothing new persisted — a résumé failure on a résumé-only posting, or both
    // wanted legs failing.
    const resumeFailed = resumeResult.status === "rejected";
    const coverFailed = wantsCover && coverResult.status === "rejected";
    if (resumeFailed && (coverFailed || !wantsCover)) {
      await settle({ status: "failed", error: "Generation failed — try again." });
    } else {
      const note = resumeFailed
        ? "Couldn’t generate the résumé — you can retry it from the job pane."
        : coverFailed
          ? "Couldn’t generate the cover letter — you can retry it from the job pane."
          : null;
      await settle({ status: "ready", error: note });
    }
  };

  after(async () => {
    try {
      if (tracingEnabled()) {
        await propagateAttributes({ userId, sessionId: jobId }, run);
        // Flush inside the after() callback, which keeps the invocation alive until
        // it resolves — the old inline pre-response flush no longer applies.
        // flushLangfuseTraces swallows its own errors, so a trace-export failure
        // can't reach the catch below: the generation already settled.
        await flushLangfuseTraces();
      } else {
        await run();
      }
    } catch (e) {
      // Generation failures are salvaged per-leg above; this catches the upsert /
      // infrastructure path where NOTHING persisted — refund the reserved kinds so a
      // failed prepare never burns allowance. Never leak internal error detail to
      // the stored user-safe message.
      await refundGenerations(userId, kinds);
      console.error("application prepare failed", e);
      await settle({ status: "failed", error: "Prefill failed — try again." });
    }
  });

  return Response.json({ generation }, { status: 202 });
}
