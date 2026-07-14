"use client";

import { saveApplicationDetails } from "@/app/actions/profileSettings";
import type { SelectHTMLAttributes } from "react";
import type { ProfileRow } from "@/lib/types";
import { Field } from "./Field";
import { SectionFormShell } from "./SectionFormShell";

function triStateValue(value: boolean | null): string {
  return value === true ? "yes" : value === false ? "no" : "";
}

type TriStateSelectProps = {
  value: boolean | null;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue">;

function TriStateSelect({ value, ...props }: TriStateSelectProps) {
  return (
    <select {...props} defaultValue={triStateValue(value)}>
      <option value="">Not specified</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}

export function ApplicationDetailsForm({ profile }: { profile: ProfileRow }) {
  return (
    <SectionFormShell action={saveApplicationDetails} submitLabel="Save details">
      <section className="profile-form-section" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact information</h2>
        <div className="field-grid">
          <Field id="full_name" name="full_name" label="Full name" required>
            <input defaultValue={profile.full_name ?? ""} autoComplete="name" />
          </Field>
          <Field id="location" name="location" label="Home location">
            <input defaultValue={profile.location ?? ""} autoComplete="address-level2" />
          </Field>
          <Field id="email" name="email" label="Email" required>
            <input type="email" defaultValue={profile.email ?? ""} autoComplete="email" />
          </Field>
          <Field id="phone" name="phone" label="Phone">
            <input type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />
          </Field>
        </div>
      </section>

      <section className="profile-form-section" aria-labelledby="links-heading">
        <h2 id="links-heading">Links</h2>
        <div className="field-grid">
          <Field id="link_linkedin" name="link_linkedin" label="LinkedIn">
            <input type="url" defaultValue={profile.links.linkedin ?? ""} />
          </Field>
          <Field id="link_github" name="link_github" label="GitHub">
            <input type="url" defaultValue={profile.links.github ?? ""} />
          </Field>
          <Field id="link_portfolio" name="link_portfolio" label="Portfolio">
            <input type="url" defaultValue={profile.links.portfolio ?? ""} />
          </Field>
        </div>
      </section>

      <section className="profile-form-section" aria-labelledby="eligibility-heading">
        <h2 id="eligibility-heading">Work eligibility</h2>
        <div className="field-grid">
          <Field id="work_authorized" name="work_authorized" label="Authorized to work?">
            <TriStateSelect className="rf-select" value={profile.work_authorized} />
          </Field>
          <Field id="needs_sponsorship" name="needs_sponsorship" label="Need sponsorship?">
            <TriStateSelect className="rf-select" value={profile.needs_sponsorship} />
          </Field>
        </div>
      </section>

      <section className="profile-form-section" aria-labelledby="screening-heading">
        <h2 id="screening-heading">Common screening answers</h2>
        <div className="field-grid">
          <Field id="screen_notice_period" name="screen_notice_period" label="Notice period">
            <input defaultValue={profile.screening_answers.notice_period ?? ""} />
          </Field>
          <Field id="screen_salary_expectation" name="screen_salary_expectation" label="Salary expectation">
            <input defaultValue={profile.screening_answers.salary_expectation ?? ""} />
          </Field>
          <Field id="screen_relocation" name="screen_relocation" label="Relocation">
            <input defaultValue={profile.screening_answers.relocation ?? ""} />
          </Field>
        </div>
      </section>

      <details className="optional-disclosure profile-form-section">
        <summary><h2>Voluntary demographic information</h2></summary>
        <p>These answers are optional and are not used to rank jobs.</p>
        <div className="field-grid">
          <Field id="eeo_gender" name="eeo_gender" label="Gender">
            <input defaultValue={profile.eeo_gender ?? ""} />
          </Field>
          <Field id="eeo_race" name="eeo_race" label="Race or ethnicity">
            <input defaultValue={profile.eeo_race ?? ""} />
          </Field>
          <Field id="eeo_veteran" name="eeo_veteran" label="Veteran status">
            <input defaultValue={profile.eeo_veteran ?? ""} />
          </Field>
          <Field id="eeo_disability" name="eeo_disability" label="Disability status">
            <input defaultValue={profile.eeo_disability ?? ""} />
          </Field>
        </div>
      </details>
    </SectionFormShell>
  );
}
