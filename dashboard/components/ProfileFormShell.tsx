"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// A failed save returns { error } instead of throwing, so the form stays mounted with the
// user's input intact and the message renders inline (mirrors the ProfileModal try/catch).
export type ProfileSaveState = { error: string } | null;

// Serialize the form's current field values for a cheap dirty check. The form is
// uncontrolled (defaultValue), so there's no field state to reuse — we compare the live
// values against a pristine snapshot. File inputs are reduced to name:size (their bytes
// can't be diffed) so picking a résumé counts as a change; the model/location pickers
// write hidden inputs, so their selections are captured here too.
function serializeForm(form: HTMLFormElement): string {
  const parts: string[] = [];
  new FormData(form).forEach((value, key) => {
    parts.push(value instanceof File ? `${key}=${value.name}:${value.size}` : `${key}=${value}`);
  });
  return parts.join("&");
}

export function ProfileFormShell({
  action,
  lastSaved,
  children,
}: {
  action: (prev: ProfileSaveState, formData: FormData) => Promise<ProfileSaveState>;
  lastSaved?: ReactNode;
  children: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  // Pristine snapshot captured after the first paint; compared against the live form to
  // decide whether there are unsaved edits.
  const pristineRef = useRef<string | null>(null);
  // Latest isPending, read inside the beforeunload closure (registered once on mount) so a
  // save-in-flight doesn't prompt during the post-save redirect. Synced via an effect
  // (never write a ref during render); the closure only reads it at unload time, always
  // after the commit, so it sees the latest value.
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  // Reactive mirror of the dirty check so the sticky bar can show an "Unsaved changes" cue.
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (formRef.current && pristineRef.current === null) {
      pristineRef.current = serializeForm(formRef.current);
    }
  }, []);

  // Live dirty check. The form is uncontrolled and the model/location pickers write to HIDDEN
  // inputs via setState (no bubbling native input event), so poll on a light interval in addition
  // to onInput — same serializeForm() the beforeunload guard uses. A save-in-flight is never dirty.
  useEffect(() => {
    const id = setInterval(() => {
      const form = formRef.current;
      if (!form || pristineRef.current === null) return;
      setDirty(!isPending && serializeForm(form) !== pristineRef.current);
    }, 400);
    return () => clearInterval(id);
  }, [isPending]);

  // Warn before leaving (reload, tab close, or a full-page nav from the slim header) while
  // there are unsaved edits — the profile form has no autosave. Dirtiness is computed from
  // the live form at unload time, so every field (including the pickers' hidden inputs) is
  // covered; a clean form navigates without a prompt.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingRef.current) return;
      const form = formRef.current;
      if (!form || pristineRef.current === null) return;
      if (serializeForm(form) === pristineRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={() => {
        const form = formRef.current;
        if (form && pristineRef.current !== null) setDirty(serializeForm(form) !== pristineRef.current);
      }}
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {children}
      {state?.error && (
        <p role="alert" style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#b25a36" }}>
          {state.error}
        </p>
      )}
      {/* Sticky save bar — Save (and the last-saved/version line) stays reachable from
          anywhere in this long single-column form. */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "16px 0",
          background: "#fff",
          borderTop: "1px solid #e7eaf0",
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          style={{
            fontWeight: 700,
            fontSize: "13.5px",
            color: "#fff",
            background: "#3b6fd4",
            border: "none",
            borderRadius: "10px",
            padding: "11px 22px",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
            boxShadow: "0 3px 10px rgba(59,111,212,.26)",
          }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {dirty && !isPending ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 600, color: "#b25a36" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#e0a03a", flexShrink: 0 }} />
            Unsaved changes
          </span>
        ) : (
          lastSaved
        )}
      </div>
    </form>
  );
}
