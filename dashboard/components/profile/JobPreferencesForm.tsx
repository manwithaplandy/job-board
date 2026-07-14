"use client";

import { useState } from "react";
import { saveJobPreferences } from "@/app/actions/profileSettings";
import { LocationPicker } from "@/components/LocationPicker";
import type { ProfileRow } from "@/lib/types";
import { Field } from "./Field";
import { SectionFormShell, useSectionField } from "./SectionFormShell";

type LocationOption = { location: string; count: number };

function PreferredLocationsField({
  locations,
  defaultValue,
  onChange,
}: {
  locations: LocationOption[];
  defaultValue: string[];
  onChange: (locations: string[]) => void;
}) {
  const name = "preferred_locations";
  const id = "location-picker-preferred_locations";
  const { error, errorId, invalid } = useSectionField(name, id);
  return (
    <div className="rf-field settings-field">
      <LocationPicker
        id={id}
        name={name}
        options={locations}
        defaultValue={defaultValue}
        ariaInvalid={invalid}
        ariaDescribedBy={error ? errorId : undefined}
        onSelectionChange={onChange}
      />
      {error ? <p id={errorId} className="field-error">{error}</p> : null}
    </div>
  );
}

export function JobPreferencesForm({
  profile,
  locations,
}: {
  profile: ProfileRow;
  locations: LocationOption[];
}) {
  const [preview, setPreview] = useState({
    locations: profile.preferred_locations,
    instructions: profile.instructions ?? "",
    companyInstructions: profile.company_instructions ?? "",
  });
  const [pickerKey, setPickerKey] = useState(0);
  const previewFrom = (values: FormData) => ({
    locations: (() => { try { return JSON.parse(String(values.get("preferred_locations") ?? "[]")) as string[]; } catch { return []; } })(),
    instructions: String(values.get("instructions") ?? ""),
    companyInstructions: String(values.get("company_instructions") ?? ""),
  });
  return (
    <SectionFormShell
      action={saveJobPreferences}
      submitLabel="Save preferences"
      onSaved={(values) => setPreview(previewFrom(values))}
      onReset={(values) => { setPreview(previewFrom(values)); setPickerKey((value) => value + 1); }}
    >
      <section className="profile-form-section" aria-labelledby="preferred-locations-heading">
        <h2 id="preferred-locations-heading">Where you want to work</h2>
        <PreferredLocationsField key={pickerKey} locations={locations} defaultValue={preview.locations} onChange={(next) => setPreview((current) => ({ ...current, locations: next }))} />
      </section>

      <section className="profile-form-section" aria-labelledby="priorities-heading">
        <h2 id="priorities-heading">Priorities and deal-breakers</h2>
        <Field
          id="instructions"
          name="instructions"
          label="Must-haves and deal-breakers"
          description="Describe the work to prioritize and roles or skills to avoid."
        >
          <textarea rows={5} defaultValue={profile.instructions ?? ""} onChange={(event) => setPreview((current) => ({ ...current, instructions: event.target.value }))} />
        </Field>
      </section>

      <section className="profile-form-section" aria-labelledby="companies-heading">
        <h2 id="companies-heading">Companies and industries</h2>
        <Field
          id="company_instructions"
          name="company_instructions"
          label="Companies and industries"
          description="Describe companies or industries to prioritize or skip."
        >
          <textarea rows={5} defaultValue={profile.company_instructions ?? ""} onChange={(event) => setPreview((current) => ({ ...current, companyInstructions: event.target.value }))} />
        </Field>
      </section>

      <section className="profile-form-section profile-preview-card" aria-labelledby="rolefit-preview-heading">
        <h2 id="rolefit-preview-heading">Rolefit will</h2>
        <p>Rolefit will use your locations and written guidance when reviewing jobs.</p>
        {preview.locations.length > 0 && (
          <p>Current locations: {preview.locations.join(", ")}</p>
        )}
        {preview.instructions && <p>Current job guidance: {preview.instructions}</p>}
        {preview.companyInstructions && (
          <p>Current company guidance: {preview.companyInstructions}</p>
        )}
      </section>
    </SectionFormShell>
  );
}
