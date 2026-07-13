import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

type FieldChromeProps = {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (contract: { id: string; describedBy?: string }) => ReactNode;
};

function FieldChrome({ id: requestedId, label, description, error, required, children }: FieldChromeProps) {
  const generatedId = useId();
  const id = requestedId ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={["rf-field", error && "rf-field--error"].filter(Boolean).join(" ")}>
      <label className="rf-field__label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {description && <div id={descriptionId} className="rf-field__description">{description}</div>}
      {children({ id, describedBy })}
      {error && <div id={errorId} className="rf-field__error" role="alert">{error}</div>}
    </div>
  );
}

function mergeDescribedBy(consumer: string | undefined, generated: string | undefined) {
  return [consumer, generated].filter(Boolean).join(" ") || undefined;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function TextField({ label, description, error, id, className, required, "aria-describedby": consumerDescribedBy, "aria-invalid": consumerInvalid, ...props }: TextFieldProps) {
  return <FieldChrome id={id} label={label} description={description} error={error} required={required}>{({ id: controlId, describedBy }) => (
    <input {...props} id={controlId} className={["rf-control", "rf-focusable", className].filter(Boolean).join(" ")} required={required} aria-invalid={error ? true : consumerInvalid} aria-describedby={mergeDescribedBy(consumerDescribedBy, describedBy)} />
  )}</FieldChrome>;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function TextArea({ label, description, error, id, className, required, "aria-describedby": consumerDescribedBy, "aria-invalid": consumerInvalid, ...props }: TextAreaProps) {
  return <FieldChrome id={id} label={label} description={description} error={error} required={required}>{({ id: controlId, describedBy }) => (
    <textarea {...props} id={controlId} className={["rf-control", "rf-control--textarea", "rf-focusable", className].filter(Boolean).join(" ")} required={required} aria-invalid={error ? true : consumerInvalid} aria-describedby={mergeDescribedBy(consumerDescribedBy, describedBy)} />
  )}</FieldChrome>;
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function SelectField({ label, description, error, id, className, required, children, "aria-describedby": consumerDescribedBy, "aria-invalid": consumerInvalid, ...props }: SelectFieldProps) {
  return <FieldChrome id={id} label={label} description={description} error={error} required={required}>{({ id: controlId, describedBy }) => (
    <span className="rf-select-wrap"><select {...props} id={controlId} className={["rf-control", "rf-select", "rf-focusable", className].filter(Boolean).join(" ")} required={required} aria-invalid={error ? true : consumerInvalid} aria-describedby={mergeDescribedBy(consumerDescribedBy, describedBy)}>{children}</select><Icon name="chevron-down" size={16} /></span>
  )}</FieldChrome>;
}

export interface FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  actionLabel?: string;
}

export function FileUpload({ label, description, error, id, className, required, actionLabel = "Choose file", onChange, "aria-describedby": consumerDescribedBy, "aria-invalid": consumerInvalid, ...props }: FileUploadProps) {
  const [filename, setFilename] = useState("No file selected");
  return <FieldChrome id={id} label={label} description={description} error={error} required={required}>{({ id: controlId, describedBy }) => (
    <div className="rf-file-upload"><input {...props} id={controlId} type="file" className={["rf-file-upload__input", className].filter(Boolean).join(" ")} required={required} aria-invalid={error ? true : consumerInvalid} aria-describedby={mergeDescribedBy(consumerDescribedBy, describedBy)} onChange={(event) => { setFilename(event.currentTarget.files?.[0]?.name ?? "No file selected"); onChange?.(event); }} /><label className="rf-button rf-button--outline rf-button--md rf-focusable" htmlFor={controlId}><Icon name="upload" size={18} />{actionLabel}</label><span className="rf-file-upload__name" role="status" aria-live="polite">{filename}</span></div>
  )}</FieldChrome>;
}
