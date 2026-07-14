"use client";

import { useActionState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { ResumeUploadField } from "@/components/rolefit/ResumeUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/FormControls";
import { FormActions } from "@/components/ui/Navigation";
import { Alert } from "@/components/ui/SystemStates";
import type { OnboardingState } from "@/app/actions/onboarding";

type LocationOption = { location: string; count: number };

export function OnboardingForm({
  action,
  locationOptions,
}: {
  action: (prev: OnboardingState, formData: FormData) => Promise<OnboardingState>;
  locationOptions: LocationOption[];
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.errors ?? {};

  return (
    <form action={formAction} className="rf-onboarding-form">
      <div className="rf-field">
        <div className="rf-field__label">Résumé</div>
        <div className="rf-field__description">
          Upload a PDF (it extracts into the box below for you to review) or paste your résumé text.
        </div>
        <ResumeUploadField textareaId="onboarding-resume-text" />
        <TextArea
          id="onboarding-resume-text"
          label="Résumé text"
          className="rf-onboarding-resume-text"
          name="resume_text"
          rows={12}
          error={errors.resume}
        />
      </div>

      <div className="rf-field">
        {/* The LocationPicker renders the single visible label ("Locations to include …");
            the cost-bounding rationale sits below it as helper text. */}
        <LocationPicker name="preferred_locations" options={locationOptions} defaultValue={[]} />
        <div className="rf-field__description">
          Your board only reviews jobs in these locations (plus remote). This is required —
          it keeps your board focused and your review costs bounded.
        </div>
        {errors.locations && <div className="rf-field__error" role="alert">{errors.locations}</div>}
      </div>

      <TextArea
        label="Instructions (optional)"
        description="What to focus on or avoid — guides the AI review."
        name="instructions"
        rows={4}
        placeholder="e.g. focus on backend/infra; avoid pure-frontend roles"
      />

      {errors.form && <Alert tone="danger">{errors.form}</Alert>}

      <FormActions><SubmitButton pendingLabel="Setting up…">Build my board</SubmitButton></FormActions>
    </form>
  );
}
