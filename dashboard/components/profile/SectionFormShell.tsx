"use client";

import {
  createContext,
  type ReactNode,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  INITIAL_SECTION_SAVE_STATE,
  type SectionSaveState,
} from "@/lib/profileSettingsState";

export interface SectionFormShellProps {
  action: (state: SectionSaveState, formData: FormData) => Promise<SectionSaveState>;
  submitLabel: string;
  children: ReactNode;
}

interface SectionFormContextValue {
  fieldErrors: Record<string, string>;
  registerField: (name: string, id: string) => () => void;
}

const SectionFormContext = createContext<SectionFormContextValue>({
  fieldErrors: {},
  registerField: () => () => {},
});

export function useSectionFormContext(): SectionFormContextValue {
  return useContext(SectionFormContext);
}

export function useSectionField(name: string, id: string) {
  const { fieldErrors, registerField } = useSectionFormContext();
  useEffect(() => registerField(name, id), [id, name, registerField]);
  const error = fieldErrors[name];
  return {
    error,
    errorId: `${id}-error`,
    invalid: Boolean(error) || undefined,
  };
}

function serializeFormData(formData: FormData): string {
  return JSON.stringify(Array.from(formData.entries(), ([name, value]) => [
    name,
    typeof value === "string"
      ? ["string", value]
      : ["file", value.name, value.type, value.size, value.lastModified],
  ]));
}

function serializeForm(form: HTMLFormElement): string {
  return serializeFormData(new FormData(form));
}

function updateResetBaseline(form: HTMLFormElement, submitted: FormData) {
  const values = new Map<string, FormDataEntryValue[]>();
  for (const [name, value] of submitted.entries()) {
    const entries = values.get(name) ?? [];
    entries.push(value);
    values.set(name, entries);
  }
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) continue;
    const submittedValues = values.get(control.name) ?? [];
    const strings = submittedValues.filter((value): value is string => typeof value === "string");
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox" || control.type === "radio") control.defaultChecked = strings.includes(control.value);
      else if (control.type !== "file") control.defaultValue = strings[0] ?? "";
    } else if (control instanceof HTMLTextAreaElement) {
      control.defaultValue = strings[0] ?? "";
    } else {
      for (const option of Array.from(control.options)) option.defaultSelected = strings.includes(option.value);
    }
  }
}

function restoreSubmittedValues(form: HTMLFormElement, submitted: FormData) {
  updateResetBaseline(form, submitted);
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLInputElement) {
      if (control.type === "checkbox" || control.type === "radio") control.checked = control.defaultChecked;
      else if (control.type === "file") control.value = "";
      else control.value = control.defaultValue;
    } else if (control instanceof HTMLTextAreaElement) {
      control.value = control.defaultValue;
    } else if (control instanceof HTMLSelectElement) {
      for (const option of Array.from(control.options)) option.selected = option.defaultSelected;
    }
  }
}

function copyFormData(source: FormData): FormData {
  const copy = new FormData();
  for (const [name, value] of source.entries()) copy.append(name, value);
  return copy;
}

function isPlainSameOriginClick(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;
  const current = new URL(window.location.href);
  return destination.pathname !== current.pathname || destination.search !== current.search;
}

export function SectionFormShell({ action, submitLabel, children }: SectionFormShellProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const pristineRef = useRef<string | null>(null);
  const savedValuesRef = useRef<FormData | null>(null);
  const [fieldIds, setFieldIds] = useState(() => new Map<string, string>());
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: SectionSaveState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.status === "success") {
      const savedSnapshot = serializeFormData(formData);
      const form = formRef.current;
      if (form) updateResetBaseline(form, formData);
      savedValuesRef.current = copyFormData(formData);
      pristineRef.current = savedSnapshot;
      setDirty(form ? serializeForm(form) !== savedSnapshot : false);
    }
    return next;
  }, INITIAL_SECTION_SAVE_STATE);
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const registerField = useCallback((name: string, id: string) => {
    setFieldIds((current) => {
      if (current.get(name) === id) return current;
      const next = new Map(current);
      next.set(name, id);
      return next;
    });
    return () => setFieldIds((current) => {
      if (current.get(name) !== id) return current;
      const next = new Map(current);
      next.delete(name);
      return next;
    });
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (pristineRef.current === null) pristineRef.current = serializeForm(form);
    const updateDirty = () => {
      const snapshot = pristineRef.current;
      if (snapshot !== null) setDirty(serializeForm(form) !== snapshot);
    };
    form.addEventListener("input", updateDirty);
    form.addEventListener("change", updateDirty);
    return () => {
      form.removeEventListener("input", updateDirty);
      form.removeEventListener("change", updateDirty);
    };
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (state.status === "error") {
      const firstId = Object.keys(state.fieldErrors)[0];
      if (firstId) document.getElementById(fieldIds.get(firstId) ?? firstId)?.focus();
    }
  }, [fieldIds, state]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const anchorClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || !isPlainSameOriginClick(event, anchor)) return;
      if (!window.confirm("You have unsaved changes. Leave this page?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", anchorClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", anchorClick, true);
    };
  }, [dirty]);

  const cancel = () => {
    const form = formRef.current;
    if (!form) return;
    if (savedValuesRef.current) restoreSubmittedValues(form, savedValuesRef.current);
    else form.reset();
    pristineRef.current = serializeForm(form);
    setDirty(false);
  };

  return (
    <SectionFormContext.Provider value={{ fieldErrors, registerField }}>
      <form ref={formRef} action={formAction} noValidate>
        {state.status === "error" && (
          <div className="section-error-summary" role="alert" aria-labelledby="section-error-title">
            <p id="section-error-title">{state.message}</p>
            {Object.entries(state.fieldErrors).length > 0 && (
              <ul>
                {Object.entries(state.fieldErrors).map(([name, message]) => (
                  <li key={name}><a href={`#${fieldIds.get(name) ?? name}`}>{message}</a></li>
                ))}
              </ul>
            )}
          </div>
        )}
        {children}
        <div className="section-actions">
          <button type="button" className="section-cancel" onClick={cancel} disabled={!dirty || pending}>Cancel</button>
          <button type="submit" className="section-save" disabled={!dirty || pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          <span className={state.status === "success" ? "section-status success" : "section-status"} aria-live="polite">
            {state.status === "success" ? "Changes saved" : ""}
          </span>
        </div>
      </form>
    </SectionFormContext.Provider>
  );
}
