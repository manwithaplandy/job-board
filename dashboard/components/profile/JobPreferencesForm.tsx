"use client";

import { saveJobPreferences } from "@/app/actions/profileSettings";
import { LocationPicker } from "@/components/LocationPicker";
import type { ProfileRow } from "@/lib/types";
import { Field } from "./Field";
import { SectionFormShell, useSectionField } from "./SectionFormShell";

type LocationOption = { location: string; count: number };

function PreferredLocationsField({
  locations,
  defaultValue,
}: {
  locations: LocationOption[];
  defaultValue: string[];
}) {
  const name = "preferred_locations";
  const id = "location-picker-preferred_locations";
  const { error, errorId, invalid } = useSectionField(name, id);
  return (
    <>
      <LocationPicker
        id={id}
        name={name}
        options={locations}
        defaultValue={defaultValue}
        ariaInvalid={invalid}
        ariaDescribedBy={error ? errorId : undefined}
      />
      {error ? <p id={errorId} className="field-error">{error}</p> : null}
    </>
  );
}

export function JobPreferencesForm({
  profile,
  locations,
}: {
  profile: ProfileRow;
  locations: LocationOption[];
}) {
  return (
    <SectionFormShell action={saveJobPreferences} submitLabel="Save preferences">
      <section aria-labelledby="preferred-locations-heading">
        <h2 id="preferred-locations-heading">Where you want to work</h2>
        <PreferredLocationsField locations={locations} defaultValue={profile.preferred_locations} />
      </section>

      <section aria-labelledby="priorities-heading">
        <h2 id="priorities-heading">Priorities and deal-breakers</h2>
        <Field
          id="instructions"
          name="instructions"
          label="Must-haves and deal-breakers"
          description="Describe the work to prioritize and roles or skills to avoid."
        >
          <textarea rows={5} defaultValue={profile.instructions ?? ""} />
        </Field>
      </section>

      <section aria-labelledby="companies-heading">
        <h2 id="companies-heading">Companies and industries</h2>
        <Field
          id="company_instructions"
          name="company_instructions"
          label="Companies and industries"
          description="Describe companies or industries to prioritize or skip."
        >
          <textarea rows={5} defaultValue={profile.company_instructions ?? ""} />
        </Field>
      </section>

      <section aria-labelledby="rolefit-preview-heading">
        <h2 id="rolefit-preview-heading">Rolefit will</h2>
        <p>Rolefit will use your locations and written guidance when reviewing jobs.</p>
        {profile.preferred_locations.length > 0 && (
          <p>Saved locations: {profile.preferred_locations.join(", ")}</p>
        )}
        {profile.instructions && <p>Saved job guidance: {profile.instructions}</p>}
        {profile.company_instructions && (
          <p>Saved company guidance: {profile.company_instructions}</p>
        )}
      </section>
    </SectionFormShell>
  );
}
