"use client";

import { useActionState } from "react";
import { LocationPicker } from "@/components/LocationPicker";
import { ResumeUploadField } from "@/components/rolefit/ResumeUploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { OnboardingState } from "@/app/actions/onboarding";

type LocationOption = { location: string; count: number };

const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column" };
const labelTextStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 600, color: "#5b6472", marginBottom: "7px",
};
const hintStyle: React.CSSProperties = {
  fontSize: "11.5px", fontWeight: 500, color: "#6b7480", marginBottom: "8px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid #e3e7ee", borderRadius: "12px", padding: "13px",
  fontSize: "13px", lineHeight: 1.5, color: "#1f2430", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff",
};
const errStyle: React.CSSProperties = {
  margin: "6px 0 0", fontSize: "12px", fontWeight: 600, color: "#b25a36",
};

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
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      <label style={fieldStyle}>
        <span style={labelTextStyle}>Résumé</span>
        <span style={hintStyle}>
          Upload a PDF (it extracts into the box below for you to review) or paste your résumé text.
        </span>
        <ResumeUploadField textareaId="onboarding-resume-text" />
        <textarea
          id="onboarding-resume-text"
          className="rf-focusable"
          name="resume_text"
          rows={12}
          style={{ ...inputStyle, resize: "vertical", marginTop: "10px" }}
        />
        {errors.resume && <p role="alert" style={errStyle}>{errors.resume}</p>}
      </label>

      <div style={fieldStyle}>
        {/* The LocationPicker renders the single visible label ("Locations to include …");
            the cost-bounding rationale sits below it as helper text. */}
        <LocationPicker name="preferred_locations" options={locationOptions} defaultValue={[]} />
        <span style={{ ...hintStyle, marginTop: "8px", marginBottom: 0 }}>
          Your board only reviews jobs in these locations (plus remote). This is required —
          it keeps your board focused and your review costs bounded.
        </span>
        {errors.locations && <p role="alert" style={errStyle}>{errors.locations}</p>}
      </div>

      <label style={fieldStyle}>
        <span style={labelTextStyle}>Instructions (optional)</span>
        <span style={hintStyle}>What to focus on or avoid — guides the AI review.</span>
        <textarea
          className="rf-focusable"
          name="instructions"
          rows={4}
          placeholder="e.g. focus on backend/infra; avoid pure-frontend roles"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </label>

      {errors.form && <p role="alert" style={errStyle}>{errors.form}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SubmitButton
          pendingLabel="Setting up…"
          style={{ borderRadius: "10px", padding: "11px 22px", fontSize: "13.5px" }}
        >
          Build my board
        </SubmitButton>
      </div>
    </form>
  );
}
