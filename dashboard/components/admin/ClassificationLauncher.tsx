"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { launchClassificationJob } from "@/app/actions/classification";
import {
  CLASSIFICATION_MODELS,
  FALLBACK_PRICING,
  SERP_QUERY_COST_USD,
  EST_SERP_EXTRA_INPUT_TOKENS,
  estimateClassificationCost,
} from "@/lib/classificationEstimate";
import type { ORModel } from "@/lib/openrouter";
import type { ClassificationSelectionMode } from "@/lib/classificationJobCodec";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { SegmentedControl } from "@/components/ui/Navigation";

// Admin launcher for a global company-classification run (rendered inside the
// isAdmin-gated /admin/classification page; launchClassificationJob re-gates
// independently). The ROM estimate is recomputed on every input change from the
// SAME pure module the server action stamps est_cost with (classificationEstimate),
// over the SAME count basis — min(cap, live target count for the mode) — so the number
// the operator sees matches the row that gets inserted. The client uses the counts
// passed down at page render; the action re-counts targets at launch, so the two can
// differ only if the corpus's target count shifts between page render and Launch.
// Pricing is resolved client-side from the passed-down catalog (live prompt/completion
// per-token) with the 2026-07-21 FALLBACK_PRICING table as the backstop.

const usd = (n: number): string => `$${n.toFixed(2)}`;

/** Live catalog per-token pricing → fallback table → null (estimate unavailable). */
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

const MODE_ITEMS = (counts: { unclassified: number; unknownRepass: number }) => [
  { label: `Unclassified (${counts.unclassified.toLocaleString()})`, value: "unclassified" },
  { label: `Re-pass unknown (${counts.unknownRepass.toLocaleString()})`, value: "unknown_repass" },
];

export function ClassificationLauncher({
  models,
  counts,
}: {
  models: ORModel[];
  counts: { unclassified: number; unknownRepass: number };
}) {
  const router = useRouter();
  const [model, setModel] = useState(CLASSIFICATION_MODELS[0]);
  const [mode, setMode] = useState<ClassificationSelectionMode>("unclassified");
  const [useSerp, setUseSerp] = useState(false);
  const [capText, setCapText] = useState("500");
  const [pending, startTransition] = useTransition();

  const pricing = useMemo(() => resolvePricing(model, models), [model, models]);
  const cap = Number.parseInt(capText, 10);
  const targetCount = mode === "unclassified" ? counts.unclassified : counts.unknownRepass;
  // The run stops when it runs out of targets, so cost tracks the realistic ceiling,
  // not the raw cap the operator typed.
  const effectiveCount = Number.isFinite(cap) && cap > 0 ? Math.min(cap, targetCount) : 0;

  const estimate = estimateClassificationCost({ count: effectiveCount, useSerp, pricing });
  // Per-COMPANY SERP delta (extra prompt tokens + the Serper.dev query fee). It's a
  // fraction of a cent, so the checkbox label renders it scaled to a per-1,000-company
  // figure — at usd()'s cent precision a per-company value would round to $0.00 and
  // read as "free". The query fee is model-independent, so a delta is shown even when
  // per-token pricing is unavailable.
  const serpDeltaPerCompany =
    (pricing ? EST_SERP_EXTRA_INPUT_TOKENS * pricing.prompt : 0) + SERP_QUERY_COST_USD;

  const launch = () => {
    startTransition(async () => {
      const res = await launchClassificationJob({ model, cap, mode, useSerp });
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't launch the classification run.");
        return;
      }
      router.refresh(); // re-seed the jobs panel below with the new pending row
    });
  };

  return (
    <div className="rf-classification-launcher">
      <div className="rf-classification-row">
        <SelectField
          id="classification-model"
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {CLASSIFICATION_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
        <TextField
          id="classification-cap"
          label="Company cap"
          type="number"
          min={1}
          max={50000}
          value={capText}
          onChange={(e) => setCapText(e.target.value)}
        />
      </div>

      <div className="rf-field">
        <span className="rf-field__label">Selection</span>
        <SegmentedControl
          label="Companies to classify"
          items={MODE_ITEMS(counts)}
          value={mode}
          onChange={(v) => setMode(v as ClassificationSelectionMode)}
        />
      </div>

      <label
        className="rf-classification-serp"
        data-ui-contract-composite="native checkbox keeps keyboard/AT support; layout lives in shared CSS"
      >
        <input
          type="checkbox"
          className="rf-focusable"
          checked={useSerp}
          onChange={(e) => setUseSerp(e.currentTarget.checked)}
        />
        <span>
          Ground with a web search first (adds ~{usd(serpDeltaPerCompany * 1000)} per 1,000 companies)
        </span>
      </label>

      <div className="rf-classification-estimate">
        <span className="rf-classification-estimate__hint">Estimated cost</span>
        <span className="rf-classification-estimate__value" data-testid="classification-estimate">
          {estimate == null ? "Estimate unavailable for this model" : usd(estimate)}
        </span>
        <span className="rf-classification-estimate__hint">
          for {effectiveCount.toLocaleString()} companies
        </span>
      </div>

      <Button
        className="rf-classification-launch"
        onClick={launch}
        loading={pending}
        loadingLabel="Launching classification run"
      >
        {pending ? "Launching…" : "Launch classification"}
      </Button>
    </div>
  );
}
