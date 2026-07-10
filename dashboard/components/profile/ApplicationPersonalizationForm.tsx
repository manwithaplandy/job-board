"use client";

import { saveApplicationPersonalization } from "@/app/actions/profileSettings";
import type { ProfileRow } from "@/lib/types";
import { Field } from "./Field";
import { SectionFormShell } from "./SectionFormShell";

export function ApplicationPersonalizationForm({ profile }: { profile: ProfileRow }) {
  return (
    <SectionFormShell action={saveApplicationPersonalization} submitLabel="Save writing preferences">
      <p>
        These defaults apply to every generated document. Per-job instructions layer on top.
      </p>
      <Field
        id="resume_generation_instructions"
        name="resume_generation_instructions"
        label="Résumé writing preferences"
        description="Describe the voice, emphasis, and formatting you prefer for tailored résumés."
      >
        <textarea rows={6} defaultValue={profile.resume_generation_instructions ?? ""} />
      </Field>
      <Field
        id="cover_letter_generation_instructions"
        name="cover_letter_generation_instructions"
        label="Cover letter writing preferences"
        description="Describe the tone, structure, and details you prefer in cover letters."
      >
        <textarea rows={6} defaultValue={profile.cover_letter_generation_instructions ?? ""} />
      </Field>
    </SectionFormShell>
  );
}
