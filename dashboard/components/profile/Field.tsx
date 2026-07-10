"use client";

import { cloneElement, type ReactElement } from "react";
import { useSectionFormContext } from "./SectionFormShell";

interface FieldProps {
  id: string;
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  children: ReactElement<Record<string, unknown>>;
}

export function Field({ id, name, label, description, required, children }: FieldProps) {
  const { fieldErrors } = useSectionFormContext();
  const error = fieldErrors[name];
  const describedBy = [description ? `${id}-description` : null, error ? `${id}-error` : null]
    .filter(Boolean).join(" ") || undefined;
  const control = cloneElement(children, {
    id,
    name,
    required,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": describedBy,
  });

  return (
    <div className="settings-field">
      <label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {description ? <p id={`${id}-description`} className="field-description">{description}</p> : null}
      {control}
      {error ? <p id={`${id}-error`} className="field-error">{error}</p> : null}
    </div>
  );
}
