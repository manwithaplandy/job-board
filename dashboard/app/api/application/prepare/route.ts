import { parseRequestBody } from "@/lib/jobLifecycle";
import { getUserClaims } from "@/lib/auth";
import { gateRejectionBody } from "@/lib/gateRejection";
import { normalizeInstructions } from "@/lib/rolefit/generationInstructions";
import { startApplicationPrep } from "@/lib/applicationPrep";

export const dynamic = "force-dynamic";
// Vercel Pro ceiling for the background `after()` work (the 202 returns in ms). The
// legs run SEQUENTIALLY, not overlapped: the résumé leg first, then a bounded prefill
// chained on the generated résumé. Worst-case arithmetic must stay under this 300s:
//   résumé leg  ≤ 2×120s + ~2s backoff ≈ 242s   (openrouterClient.ts: MAX_ATTEMPTS=2,
//                                                 PER_ATTEMPT_TIMEOUT_MS=120000)
//   prefill leg ≤ PREFILL_TIMEOUT_MS + ~2s backoff ≈ 47s (lib/applicationPrep.ts)
//   persistence   (upsert + settle)              ≈ a few seconds
//   total       ≈ 242 + 47 + persistence < 300s  (~10s margin)
// The cover leg (when the posting asks) runs in parallel with the résumé and is dominated
// by it. Prefill is best-effort: if it caps out, the signal aborts it, the answers are
// dropped, and the résumé still persists.
export const maxDuration = 300;

// User-facing label is "Prefill application"; kind stays 'prepare' (see schema.sql).
//
// The gate, reservation, tracking row and background generation live in
// lib/applicationPrep.ts (plan Task 1.16), shared with the agent's confirm card and
// approval tools. This route keeps auth and the per-job instruction boxes, and maps each
// outcome to the status and body it has always returned:
//   401 no session · 400 no jobId, instructions over the cap, non-Greenhouse job
//   422 no profile résumé · 404 unknown job · 202 payload/questions not ready
//   500 no OpenRouter key · 402/429 the money gate · 502 tracking row failed
//   202 { generation } started, or an identical pending prep already running
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to prefill an application" }, { status: 401 });
  const userId = claims.id;

  const { jobId, resumeInstructions: rawResumeInstr, coverLetterInstructions: rawCoverInstr } =
    parseRequestBody(await req.json().catch(() => null));
  if (typeof jobId !== "string" || !jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  // Per-job instruction boxes → each leg's own instructions. Over-cap is a caller
  // error (400) rejected BEFORE the gate so a bad request never charges allowance.
  const resumeNorm = normalizeInstructions(rawResumeInstr, "résumé");
  if (!resumeNorm.ok) return Response.json({ error: resumeNorm.error }, { status: 400 });
  const coverNorm = normalizeInstructions(rawCoverInstr, "cover letter");
  if (!coverNorm.ok) return Response.json({ error: coverNorm.error }, { status: 400 });

  const out = await startApplicationPrep(userId, claims.email, jobId, {
    resumeInstructions: resumeNorm.value,
    coverLetterInstructions: coverNorm.value,
  });
  switch (out.status) {
    case "no_resume":
      return Response.json({ error: "set up your profile résumé first" }, { status: 422 });
    case "unknown_job":
      return Response.json({ error: "job not found" }, { status: 404 });
    case "not_greenhouse":
      return Response.json({ error: "Prefill is available for Greenhouse postings only" }, { status: 400 });
    case "pending_payload":
      return Response.json(out.body, { status: 202 });
    case "not_configured":
      return Response.json({ error: "application prefill not configured" }, { status: 500 });
    case "no_plan":
    case "allowance_exhausted":
      return Response.json(gateRejectionBody(out.gate), { status: out.gate.status });
    case "tracking_failed":
      return Response.json({ error: "Prefill couldn’t start — try again." }, { status: 502 });
    case "already_running":
    case "started":
      return Response.json({ generation: out.generation }, { status: 202 });
  }
}
