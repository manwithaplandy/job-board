"use client";

import { saveAdvancedAiSettings } from "@/app/actions/profileSettings";
import { ModelPicker } from "@/components/ModelPicker";
import { ReasoningEffortSelect } from "@/components/ReasoningEffortSelect";
import { CURATED_MODELS, DEFAULT_MODEL_ID, type ORModel } from "@/lib/openrouter";
import { DEFAULT_COVER_MODEL } from "@/lib/rolefit/coverLetterClient";
import { DEFAULT_RESUME_MODEL } from "@/lib/rolefit/resumeClient";
import type { ProfileRow } from "@/lib/types";
import { SectionFormShell, useSectionField } from "./SectionFormShell";

function ModelField(props: React.ComponentProps<typeof ModelPicker>) {
  const id = `model-picker-${props.name}`;
  const { error, errorId, invalid } = useSectionField(props.name, id);
  return (
    <div className="rf-field settings-field">
      <ModelPicker {...props} id={id} ariaInvalid={invalid}
        ariaDescribedBy={error ? errorId : undefined} />
      {error ? <p id={errorId} className="field-error">{error}</p> : null}
    </div>
  );
}

export function AdvancedAiForm({
  profile,
  models,
  isPro,
}: {
  profile: ProfileRow;
  models: ORModel[];
  isPro: boolean;
}) {
  return (
    <SectionFormShell action={saveAdvancedAiSettings} submitLabel="Save AI settings">
      <section className="rf-card rf-card--lg profile-form-section" aria-labelledby="review-models-heading">
        <h2 id="review-models-heading">Job review</h2>
        <div className="rf-field settings-field profile-readonly-field">
          <p><strong>Stage 1 — title and company check</strong></p>
          <p className="field-description">Always uses the Rolefit default</p>
        </div>
        <ModelField
          label="Stage 2 — full-description review model"
          name="model_stage2"
          models={models}
          curated={CURATED_MODELS}
          defaultValue={profile.model_stage2}
          placeholder={DEFAULT_MODEL_ID}
          hint={isPro ? "Choose the model used for detailed job review." : "Choose the review model — some models require the Pro plan."}
        />
        <ModelField
          label="Company review model"
          name="model_company"
          models={models}
          curated={CURATED_MODELS}
          defaultValue={profile.model_company}
          placeholder={DEFAULT_MODEL_ID}
          hint="Choose the model used to summarize company information."
        />
      </section>

      <section className="rf-card rf-card--lg profile-form-section" aria-labelledby="document-models-heading">
        <h2 id="document-models-heading">Application documents</h2>
        <ModelField label="Résumé model" name="model_resume" models={models}
          curated={CURATED_MODELS} defaultValue={profile.model_resume}
          placeholder={DEFAULT_RESUME_MODEL} />
        <ReasoningEffortSelect label="Résumé reasoning effort" name="reasoning_effort_resume"
          defaultValue={profile.reasoning_effort_resume} isPro={isPro} />
        <ModelField label="Cover letter model" name="model_cover" models={models}
          curated={CURATED_MODELS} defaultValue={profile.model_cover}
          placeholder={DEFAULT_COVER_MODEL} />
        <ReasoningEffortSelect label="Cover letter reasoning effort" name="reasoning_effort_cover"
          defaultValue={profile.reasoning_effort_cover} isPro={isPro} />
      </section>
    </SectionFormShell>
  );
}
