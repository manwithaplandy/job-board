import { after } from "next/server";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { getUserClaims } from "@/lib/auth";
import { getProfile, getJobForPackage, upsertApplicationPackage } from "@/lib/queries";
import { gateRejectionBody } from "@/lib/gateRejection";
import { reserveGenerations, refundGenerations, type GenerationKind } from "@/lib/usage";
import { createGenerationJob, settleGenerationJob } from "@/lib/generationJobs";
import { applicationAnswersFromProfile } from "@/lib/applicationAnswers";
import { applyUrl } from "@/lib/rolefit/applyUrl";
import { DEFAULT_RESUME_MODEL, generateResume } from "@/lib/rolefit/resumeClient";
import { DEFAULT_COVER_MODEL, generateCoverLetter } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
import { fetchGreenhouseQuestions, type GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import { toPrefillQuestions, type PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { getResumeSource } from "@/lib/rolefit/resumeSource";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { tracingEnabled, flushLangfuseTraces } from "@/lib/observability";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";

export const dynamic = "force-dynamic";
// Vercel Pro ceiling. The 202 response returns in milliseconds; the budget covers
// the background `after()` work — the legs overlap, so the slowest leg bounds it:
// 2 LLM attempts × 120s + backoff ≈ 242s (see lib/rolefit/openrouterClient.ts).
export const maxDuration = 300;

// "Prepare application": build the persisted package once (résumé + cover letter +
// answers snapshot, and — Greenhouse only — the real question schema + LLM-prefilled
// answers) and upsert it. The board loads the saved package instead of regenerating.
//
// Async contract (mirrors /api/resume): auth/validation/config/gate stay synchronous,
// then ONE 'pending' generation_jobs row of kind='prepare' is recorded and the route
// returns 202. The legs run in `after()` under Promise.allSettled (a failure in one
// LLM leg doesn't block the others); the row settles 'ready' when the legs settle —
// with a user-safe partial note if one LLM leg failed — and 'failed' only when the
// whole prepare throws or BOTH LLM legs fail (nothing new was generated).
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to prepare an application" }, { status: 401 });
  const userId = claims.id;

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

  // Prepare generates BOTH a résumé and a cover letter, so reserve both up front (block
  // if EITHER is exhausted). reserveGenerations is ATOMIC (avoids check-then-charge
  // TOCTOU) and all-or-nothing across the two kinds; a rejected leg is REFUNDED below so
  // it never burns allowance. After the 404/422/500 validation so we never charge a
  // request that can't generate. No plan → 402, exhausted → 429.
  const gate = await reserveGenerations(userId, claims.email, ["resume", "cover"]);
  if (!gate.ok) return Response.json(gateRejectionBody(gate), { status: gate.status });

  // Pending tracking row — created AFTER the reserve, so a pending row always
  // corresponds to charged slots. A concurrent duplicate converges on the existing
  // pending row: refund THIS request's extra reservations and 202 idempotently.
  let tracked;
  try {
    tracked = await createGenerationJob(userId, jobId, "prepare");
  } catch (e) {
    await refundGenerations(userId, ["resume", "cover"]);
    console.error("application prepare tracking failed", {
      userId, jobId, error: e instanceof Error ? e.message : String(e),
    });
    return Response.json({ error: "Preparation couldn’t start — try again." }, { status: 502 });
  }
  const generation = { ...tracked.job, jobTitle: job.title, company: job.company_name };
  if (!tracked.created) {
    await refundGenerations(userId, ["resume", "cover"]);
    return Response.json({ generation }, { status: 202 });
  }
  const generationJobId = tracked.job.id;

  // Status writes never throw out of the background callback: a failed write is
  // logged and the row stays 'pending' for the staleness sweep — it must not
  // trigger the outer catch's both-kind refund after legs already settled.
  const settle = (outcome: { status: "ready" | "failed"; error?: string | null }) =>
    settleGenerationJob(userId, generationJobId, outcome).catch((e) => {
      console.error("application prepare status write failed", {
        userId, jobId, generationJobId, error: e instanceof Error ? e.message : String(e),
      });
    });

  const answers = applicationAnswersFromProfile(profile);
  // Résumé plaintext via the shared helper.
  const { resumeText } = getResumeSource(profile);

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
    let resumeTraceId: string | null = null;
    const [resumeResult, coverResult, ghResult] = await Promise.allSettled([
      // résumé leg — wrapped so the managed judge has a clean `resume` trace and
      // we capture its trace id for the golden-dataset join. Returns the
      // TailoredResume so resumeResult.value stays the résumé (not { resume, checks }).
      (async () => {
        const genArgs = {
          resumeText,
          job: { title: job.title, company: job.company_name, description: job.description },
          model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
          apiKey,
        };
        if (!tracingEnabled()) return (await generateResume(genArgs)).resume;
        return startActiveObservation(
          "resume",
          async (span) => {
            resumeTraceId = span.traceId;
            span.update({
              // `background` = the candidate's real source résumé, the grounding
              // truth the judge compares generated claims against ({{candidate_background}}).
              input: { title: job.title, company: job.company_name, description: job.description, background: resumeText },
            });
            const r = await generateResume(genArgs);
            span.update({
              output: composeResumeText(r.resume),
              metadata: { mechanical_checks: r.checks },
            });
            return r.resume;
          },
          { asType: "span" },
        );
      })(),
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

    await upsertApplicationPackage(userId, jobId, {
      resume,
      coverLetter,
      answersSnapshot: answers,
      greenhouseQuestions: gh.greenhouseQuestions,
      prefilledAnswers: gh.prefilledAnswers,
      applyUrl: applyUrl(job.ats, job.url),
      resumeTraceId,
      profileVersion: profile.profile_version,
    });
    // Both kinds were reserved (charged) up front; REFUND any leg that rejected — a
    // rejected leg (e.g. OpenRouter outage) persists a partial package but must never
    // burn its kind's allowance (T9: "a failed generation never burns allowance";
    // mirrors the sibling /api/resume + /api/cover-letter routes). Both-fulfilled refunds
    // nothing. A whole-prepare failure throws before here and refunds both in the outer
    // catch. Model choice (model_resume/model_cover) is intentionally NOT tier-gated —
    // generation is 1–3% of cost (spec); the monthly counter is the abuse cap.
    const refundKinds: GenerationKind[] = [
      ...(resumeResult.status === "rejected" ? (["resume"] as const) : []),
      ...(coverResult.status === "rejected" ? (["cover"] as const) : []),
    ];
    if (refundKinds.length) await refundGenerations(userId, refundKinds);
    // Settle the tracked prepare. The old inline response carried per-leg status;
    // the client now reloads the persisted package on 'ready' and derives the pane
    // states from its contents, so the row only distinguishes: clean success,
    // partial success (user-safe note in `error`), and nothing-generated.
    if (resumeResult.status === "rejected" && coverResult.status === "rejected") {
      await settle({ status: "failed", error: "Generation failed — try again." });
    } else {
      const note =
        resumeResult.status === "rejected"
          ? "Couldn’t generate the résumé — you can retry it from the job pane."
          : coverResult.status === "rejected"
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
      // infrastructure path where NOTHING persisted — refund both reserved kinds so a
      // failed prepare never burns allowance. Never leak internal error detail to
      // the stored user-safe message.
      await refundGenerations(userId, ["resume", "cover"]);
      console.error("application prepare failed", e);
      await settle({ status: "failed", error: "Preparation failed — try again." });
    }
  });

  return Response.json({ generation }, { status: 202 });
}
