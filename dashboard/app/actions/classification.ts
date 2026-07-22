"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { serviceSql } from "@/lib/db";
import { getStructuredModels, type ORModel } from "@/lib/openrouter";
import {
  CLASSIFICATION_MODELS,
  FALLBACK_PRICING,
  estimateClassificationCost,
} from "@/lib/classificationEstimate";
import { countTargets } from "@/lib/classificationJobs";

// SERVICE-ROLE JUSTIFICATION (this file is on the serviceRoleAllowlist): classification
// jobs are the operator-global classification console. classification_jobs is RLS
// deny-all with NO authenticated grant (Task 1) — there is no per-tenant context to
// drop into — so the enqueue/cancel writes run on serviceSql. SECURITY: these server
// actions are independently reachable regardless of the /admin/classification page
// gate, so each re-gates on isAdmin FIRST (verified JWT email vs ADMIN_EMAILS, fail
// closed) before any validation or SQL — mirroring app/actions/companies.ts.

const CAP_MIN = 1;
const CAP_MAX = 50_000;

/**
 * Per-token pricing for the model: live OpenRouter catalog first (parsed from the
 * string pricing), then the 2026-07-21 fallback table, then null (estimate
 * unavailable). Mirrors the client launcher's resolution so est_cost matches the
 * number the operator saw.
 */
function resolvePricing(
  model: string,
  models: ORModel[],
): { prompt: number; completion: number } | null {
  const live = models.find((m) => m.id === model);
  if (live) {
    const prompt = parseFloat(live.pricing.prompt);
    const completion = parseFloat(live.pricing.completion);
    if (Number.isFinite(prompt) && Number.isFinite(completion)) {
      return { prompt, completion };
    }
  }
  return FALLBACK_PRICING[model] ?? null;
}

/**
 * Enqueue an admin classification run. Validates the model against the curated
 * CLASSIFICATION_MODELS set and the cap against [1, 50000], stamps a server-computed
 * est_cost (live pricing → fallback → null) over min(cap, live target count for the
 * mode) — the same count basis the launcher shows, since a run stops when it runs out
 * of targets — and inserts a pending classification_jobs row for the always-on worker
 * to claim (company_cap stays the raw cap the operator typed). Returns { ok:false,
 * error } for user-legible validation failures (Next redacts thrown action messages);
 * the unauthorized case throws by design (strangers get no detail).
 */
export async function launchClassificationJob(input: {
  model: string;
  cap: number;
  mode: "unclassified" | "unknown_repass";
  useSerp: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");

  const { model, cap, mode, useSerp } = input;
  if (!CLASSIFICATION_MODELS.includes(model)) {
    return { ok: false, error: "Unknown classification model." };
  }
  if (!Number.isInteger(cap) || cap < CAP_MIN || cap > CAP_MAX) {
    return { ok: false, error: `Cap must be a whole number between ${CAP_MIN} and ${CAP_MAX}.` };
  }
  if (mode !== "unclassified" && mode !== "unknown_repass") {
    return { ok: false, error: "Unknown selection mode." };
  }

  const pricing = resolvePricing(model, await getStructuredModels());
  // A run stops when it runs out of targets, so the realistic cost ceiling is
  // min(cap, live target count for the mode) — matching what the launcher showed the
  // operator. The stored company_cap stays the raw cap; only est_cost is clamped.
  const counts = await countTargets();
  const targetCount = mode === "unclassified" ? counts.unclassified : counts.unknownRepass;
  const effective = Math.min(cap, targetCount);
  const estCost = estimateClassificationCost({ count: effective, useSerp, pricing });

  await serviceSql`
    INSERT INTO classification_jobs (model, company_cap, selection_mode, use_serp, est_cost)
    VALUES (${model}, ${cap}, ${mode}, ${useSerp}, ${estCost})
  `;
  revalidatePath("/admin/classification");
  return { ok: true };
}

/**
 * Cancel a pending or running job. The status IN ('pending','running') guard makes it
 * a no-op on an already-finished/canceled job (idempotent, race-safe against the
 * worker finishing it first). The worker also observes the flip and drains gracefully.
 */
export async function cancelClassificationJob(id: number): Promise<void> {
  if (!isAdmin(await getUserClaims())) throw new Error("not authorized");
  await serviceSql`
    UPDATE classification_jobs SET status = 'canceled'
    WHERE id = ${id} AND status IN ('pending', 'running')
  `;
  revalidatePath("/admin/classification");
}
