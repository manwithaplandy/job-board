// Starting an application prep (plan Task 1.16): the gate, the reservation, the
// generation_jobs row and the background generation, lifted unchanged from
// app/api/application/prepare/route.ts so the route, the confirm card's Approve
// (confirmIntent) and the agent's approval tools (start_application_prep,
// refine_documents) all go through one path.
//
// The route maps each outcome back to the status and body it always returned (see the
// route), so its contract is unchanged.
//
// Greenhouse-ONLY: prefill needs the posting's real question schema; a non-Greenhouse job
// is refused before any charge.
//
// Async contract (mirrors /api/resume): validation, config and the gate stay synchronous,
// then ONE 'pending' generation_jobs row of kind='prepare' is recorded and the caller
// answers at once. In `after()` the résumé leg runs first; on success it chains a
// bounded, best-effort prefill fed the generated résumé (a prefill failure is swallowed:
// the résumé still persists). The cover leg runs in parallel, ONLY when the posting asks
// for a cover letter (it's the only leg besides résumé that reserves allowance). The row
// settles 'ready' when the legs settle, with a user-safe partial note if a WANTED leg
// failed, and 'failed' only when nothing new persisted.
//
// refine (refine_documents, spec 5(c) step 4): only the target documents are reserved
// and regenerated. Once the reservation succeeds and the new tracking row exists, the
// instructions are saved as each target's instructions box (the *_instructions_draft
// columns the box saves), both in one transaction; the regenerated document then stores
// them as resume_instructions / cover_letter_instructions in lockstep with itself
// (upsertApplicationPackage). A refused reservation, an identical prep already running or
// a failed tracking insert writes nothing.
//
// after() from inside a tool's execute: Next's after() registers the task with the
// request's waitUntil whether or not the response has finished (next 16.4.3
// after-context.js), and a tool's execute runs inside the agent route's request scope.
// Outside any request scope (a script, an eval harness) it throws; the task then runs
// without it, as the agent loop does for its own persistence.
import { requestJobPayload, type DemandResult } from "@/lib/jobLifecycle";
import { after } from "next/server";
import { propagateAttributes } from "@langfuse/tracing";
import { getProfile, getJobForPackage, getJobQuestion, upsertApplicationPackage, upsertInstructionDrafts } from "@/lib/queries";
import type { AllowanceGateRejection } from "@/lib/gateRejection";
import { reserveGenerations, refundGenerations, type GenerationKind } from "@/lib/usage";
import { isBilledGenerationError } from "@/lib/rolefit/openrouterClient";
import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
import type { GenerationJobView } from "@/lib/generationJobCodec";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "@/lib/rolefit/coverLetterQuestion";
import { toPrefillQuestions, type PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { getStructuredModels } from "@/lib/openrouter";
import { resolveReasoningSetting } from "@/lib/rolefit/generationSettings";
import { tracingEnabled, ensureTracingStarted, flushLangfuseTraces } from "@/lib/observability";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

// Hard ceiling on the prefill leg (best-effort). It runs AFTER the résumé, so this keeps
// résumé (≤242s) + prefill (≤~47s) + persistence under the route's maxDuration=300 even
// when the résumé leg hits its worst case. Do NOT raise past ~45s without re-checking
// that budget (see the route's maxDuration comment).
const PREFILL_TIMEOUT_MS = 45_000;

export type PrepTarget = "resume" | "cover" | "both";

export interface PrepOptions {
  resumeInstructions?: string | null;
  coverLetterInstructions?: string | null;
  /** refine_documents: regenerate only these documents (see the module header). */
  refine?: { target: PrepTarget };
}

export type PrepGeneration = GenerationJobView & { jobTitle: string; company: string };

export type PrepOutcome =
  | { status: "started"; generationId: string; generation: PrepGeneration }
  /** An identical prep was already pending: this call's reservation was refunded. */
  | { status: "already_running"; generationId: string; generation: PrepGeneration }
  /** The posting's details or questions are not ready; nothing was charged. */
  | { status: "pending_payload"; body: { payload: unknown; message: string } }
  | { status: "no_plan"; gate: AllowanceGateRejection }
  | { status: "allowance_exhausted"; kind: GenerationKind; gate: AllowanceGateRejection }
  | { status: "no_resume" }
  | { status: "unknown_job" }
  | { status: "not_greenhouse" }
  | { status: "not_configured" }
  /** The tracking row (or a refine's instructions) could not be written; refunded. */
  | { status: "tracking_failed" };

function targetKinds(target: PrepTarget): GenerationKind[] {
  if (target === "resume") return ["resume"];
  if (target === "cover") return ["cover"];
  return ["resume", "cover"];
}

/** Runs `task` after the response through next/server's after(), or at once without a request scope. */
function scheduleAfter(task: () => Promise<void>): void {
  try {
    after(task);
  } catch (e) {
    console.warn("application prepare: after() unavailable; running without it", e instanceof Error ? e.name : typeof e);
    void task();
  }
}

export async function startApplicationPrep(
  userId: string,
  email: string | null,
  jobId: string,
  opts: PrepOptions = {},
): Promise<PrepOutcome> {
  const resumeInstructions = opts.resumeInstructions ?? null;
  const coverLetterInstructions = opts.coverLetterInstructions ?? null;

  const profile = await getProfile(userId);
  if (!profile?.resume_text) return { status: "no_resume" };
  const job = await getJobForPackage(jobId, userId);
  if (!job) return { status: "unknown_job" };
  if (job.ats !== "greenhouse") return { status: "not_greenhouse" };

  const payload: DemandResult = await requestJobPayload(userId, jobId, "prepare");
  if (payload.status === "pending" || payload.status === "deferred") {
    return {
      status: "pending_payload",
      body: { payload, message: payload.reason ?? (payload.status === "pending" ? "Job details are being prepared. Try again shortly." : "Job details are unavailable. Your saved artifacts are unchanged.") },
    };
  }
  if (typeof payload.description === "string") job.description = payload.description;
  if (!job.description?.trim()) return { status: "pending_payload", body: { payload: { status: "deferred" }, message: "Job description unavailable." } };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { status: "not_configured" };

  const resumeModel = profile.model_resume ?? DEFAULT_RESUME_MODEL;
  const coverModel = profile.model_cover ?? DEFAULT_COVER_MODEL;

  const questions = payload.status === "ready" ? payload.questions : (payload.questions ?? await getJobQuestion(userId, jobId));
  if (questions === null) return { status: "pending_payload", body: { payload: { status: "pending" }, message: "Application questions are being prepared." } };

  // A full prep always writes the résumé and the cover letter only when the posting asks
  // for one; a refine writes exactly its targets.
  const wantsResume = opts.refine ? opts.refine.target !== "cover" : true;
  const wantsCover = opts.refine ? opts.refine.target !== "resume" : hasCoverLetterQuestion(questions);

  // Charge each written document. reserveGenerations is ATOMIC (avoids check-then-charge
  // TOCTOU) and all-or-nothing across the kinds; a leg that failed before inference is
  // REFUNDED below, a leg OpenRouter billed is not. After the validation above so we
  // never charge a request that can't generate.
  const kinds: GenerationKind[] = opts.refine ? targetKinds(opts.refine.target) : wantsCover ? ["resume", "cover"] : ["resume"];
  // The catalog is fetched CONCURRENTLY with the gate; getStructuredModels is 1h-cached
  // and returns [] (fail-open) on failure, so it adds no new rejection path even on the
  // reject path.
  const [gate, catalog] = await Promise.all([
    reserveGenerations(userId, email, kinds),
    getStructuredModels(),
  ]);
  if (!gate.ok) {
    if (gate.status === 402) return { status: "no_plan", gate };
    return { status: "allowance_exhausted", kind: gate.kind ?? kinds[0], gate };
  }

  // Resolve each leg's reasoning setting from the gate's OWN plan snapshot (the same
  // authoritative plan the charge used — no second getViewerPlan lookup): clamp to the
  // tier, and OMIT the param (null) for models that can't take it. The prefill leg is
  // intentionally excluded — Task 6 hardcoded its reasoning setting.
  const resumeReasoning = resolveReasoningSetting(
    gate.plan, profile.reasoning_effort_resume, resumeModel, catalog,
  );
  const coverReasoning = resolveReasoningSetting(
    gate.plan, profile.reasoning_effort_cover, coverModel, catalog,
  );

  // Pending tracking row — created AFTER the reserve, so a pending row always
  // corresponds to charged slots. A concurrent duplicate converges on the existing
  // pending row: refund THIS request's extra reservations and report it idempotently.
  let tracked;
  try {
    tracked = await createGenerationJob(userId, jobId, "prepare", payload);
  } catch (e) {
    await refundGenerations(userId, kinds);
    console.error("application prepare tracking failed", {
      userId, jobId, error: e instanceof Error ? e.message : String(e),
    });
    return { status: "tracking_failed" };
  }
  const generation: PrepGeneration = { ...tracked.job, jobTitle: job.title, company: job.company_name };
  if (!tracked.created) {
    await refundGenerations(userId, kinds);
    return { status: "already_running", generationId: tracked.job.id, generation };
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

  // refine: the instructions are saved only now that the reservation holds AND this call
  // owns the new tracking row, so a refused reservation, an identical prep already
  // running or a failed tracking insert leaves the instruction boxes unchanged. Both
  // targets are written in one transaction; if that fails, nothing was written: refund
  // (before settling, as the background catch does) and fail the row.
  if (opts.refine) {
    try {
      await upsertInstructionDrafts(userId, jobId, {
        ...(wantsResume ? { resume: resumeInstructions ?? "" } : {}),
        ...(wantsCover ? { cover: coverLetterInstructions ?? "" } : {}),
      });
    } catch (e) {
      await refundGenerations(userId, kinds);
      console.error("application refine instructions failed", {
        userId, jobId, error: e instanceof Error ? e.message : String(e),
      });
      await settle({ status: "failed", error: "Generation failed — try again." });
      return { status: "tracking_failed" };
    }
  }

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
    // swallowed (best-effort) so the résumé still persists. A cover-only refine runs no
    // résumé leg (sentinel rejection, never counted as a failure).
    const resumeLeg: Promise<{ resume: TailoredResume; prefilled: PrefilledAnswer[] | null }> = wantsResume
      ? (async (): Promise<{ resume: TailoredResume; prefilled: PrefilledAnswer[] | null }> => {
      const { resume, traceId } = await generateResume({
        resumeText,
        instructions: resumeInstructions,
        profileInstructions: profile.resume_generation_instructions,
        job: { title: job.title, company: job.company_name, description: job.description },
        model: resumeModel,
        reasoningEffort: resumeReasoning,
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
    })()
      : Promise.reject(new Error("no résumé requested")); // sentinel; not counted as a failure

    // Cover leg — only when the posting asks (or a refine targets it). Independent of the
    // résumé (uses profile text). The sentinel rejection is consumed by
    // Promise.allSettled → never an unhandled rejection.
    const coverLeg: Promise<TailoredCoverLetter> = wantsCover
      ? (async (): Promise<TailoredCoverLetter> => {
          const { letter, traceId } = await generateCoverLetter({
            resumeText,
            candidateName: profile.full_name ?? null,
            instructions: coverLetterInstructions,
            profileInstructions: profile.cover_letter_generation_instructions,
            job: {
              title: job.title, company: job.company_name, description: job.description,
              about: job.about, requirements: job.requirements,
              skillGaps: job.skill_gaps, redFlags: job.red_flags,
            },
            model: coverModel,
            reasoningEffort: coverReasoning,
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

    if (wantsResume && resumeResult.status === "rejected") console.error("resume generation failed", resumeResult.reason);
    if (wantsCover && coverResult.status === "rejected") console.error("cover letter generation failed", coverResult.reason);

    await upsertApplicationPackage(userId, jobId, {
      payload,
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

    // Refund charged legs that failed BEFORE inference (fetch threw / non-2xx). A leg whose
    // response OpenRouter already billed (truncated / non-JSON / failed parse after a 200) keeps
    // its charge — otherwise a prompt engineered to fail lets one slot buy unlimited inference.
    // A leg is only charged (and only "failed") when wanted; an unwanted leg is the sentinel
    // rejection above and is never refunded. Both-fulfilled refunds nothing. A whole-prepare
    // failure throws before here and refunds `kinds` in the outer catch. Model choice (model_resume/model_cover) is intentionally NOT tier-gated —
    // generation is 1–3% of cost (spec); the monthly counter is the abuse cap.
    const refundKinds: GenerationKind[] = [
      ...(wantsResume && resumeResult.status === "rejected" && !isBilledGenerationError(resumeResult.reason)
        ? (["resume"] as const) : []),
      ...(wantsCover && coverResult.status === "rejected" && !isBilledGenerationError(coverResult.reason)
        ? (["cover"] as const) : []),
    ];
    if (refundKinds.length) await refundGenerations(userId, refundKinds);

    // Settle the tracked prepare. The client reloads the persisted package on 'ready' and
    // derives the pane states from its contents, so the row only distinguishes: clean
    // success, partial success (user-safe note in `error`), and nothing-generated. 'failed'
    // only when nothing new persisted — every wanted leg failed.
    const resumeFailed = wantsResume && resumeResult.status === "rejected";
    const coverFailed = wantsCover && coverResult.status === "rejected";
    if ((resumeFailed || !wantsResume) && (coverFailed || !wantsCover)) {
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

  scheduleAfter(async () => {
    try {
      if (tracingEnabled()) {
        // Init tracing BEFORE propagateAttributes: it wires the AsyncLocalStorage
        // context manager, and context.with() under the boot-time noop manager
        // would silently drop userId/sessionId from the first trace per instance.
        await ensureTracingStarted();
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
      // infrastructure path where NOTHING persisted — refund the reserved kinds (an
      // infrastructure failure, not a billed generation the user's prompt can provoke). Never leak internal error detail to
      // the stored user-safe message.
      await refundGenerations(userId, kinds);
      console.error("application prepare failed", e);
      await settle({ status: "failed", error: "Prefill failed — try again." });
    }
  });

  return { status: "started", generationId: generationJobId, generation };
}
