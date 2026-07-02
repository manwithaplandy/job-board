"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

// A failed save returns { error } instead of throwing, so the form stays mounted with the
// user's input intact and the message renders inline (mirrors the ProfileModal try/catch).
export type ProfileSaveState = { error: string } | null;

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
  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {children}
      {state?.error && (
        <p role="alert" style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#b25a36" }}>
          {state.error}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            alignSelf: "flex-start",
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
        {lastSaved}
      </div>
    </form>
  );
}
