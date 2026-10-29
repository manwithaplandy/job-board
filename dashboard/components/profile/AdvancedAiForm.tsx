"use client";

import { saveAdvancedAiSettings } from "@/app/actions/profileSettings";
import { ReasoningEffortSelect } from "@/components/ReasoningEffortSelect";
import type { ProfileRow } from "@/lib/types";
import { SectionFormShell } from "./SectionFormShell";

// Models are decided by plan (lib/entitlements.ts GENERATION_MODELS and the per-tier
// stage-2 model), so this form only exposes reasoning effort.
export function AdvancedAiForm({
  profile,
  isPro,
}: {
  profile: ProfileRow;
  isPro: boolean;
}) {
  return (
    <SectionFormShell action={saveAdvancedAiSettings} submitLabel="Save AI settings">
      <section className="rf-card rf-card--lg profile-form-section" aria-labelledby="document-models-heading">
        <h2 id="document-models-heading">Application documents</h2>
        <p className="field-description">
          Rolefit picks the AI models for job review and document writing based on your plan.
        </p>
        <ReasoningEffortSelect label="Résumé reasoning effort" name="reasoning_effort_resume"
          defaultValue={profile.reasoning_effort_resume} isPro={isPro} />
        <ReasoningEffortSelect label="Cover letter reasoning effort" name="reasoning_effort_cover"
          defaultValue={profile.reasoning_effort_cover} isPro={isPro} />
      </section>
    </SectionFormShell>
  );
}
