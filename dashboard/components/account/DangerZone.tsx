"use client";

import { useActionState } from "react";
import { deleteMyAccount, type DeleteAccountState } from "@/app/actions/account";
import { SubmitButton } from "@/components/ui/SubmitButton";

// Profile "Danger zone" (T2 export + T3 deletion). Export is offered FIRST (compliance:
// let people take their data before erasing it). Deletion requires typing DELETE (or
// the account email) — the server action re-checks this against the caller's own
// verified session, so this input is a UX guard, not the security boundary.

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--danger-border)", background: "var(--danger-bg)", borderRadius: "14px",
  padding: "18px 20px", marginTop: "24px",
};
const legendStyle: React.CSSProperties = {
  fontSize: "13px", fontWeight: 800, color: "var(--danger)", marginBottom: "6px",
};
const rowLabelStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" };
const hintStyle: React.CSSProperties = {
  fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 10px", lineHeight: 1.5,
};
const linkBtnStyle: React.CSSProperties = {
  display: "inline-block", border: "1px solid var(--border-strong)", background: "var(--bg-surface)",
  borderRadius: "10px", padding: "9px 16px", fontSize: "13px", fontWeight: 600,
  color: "var(--text-primary)", textDecoration: "none",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--danger-border)", borderRadius: "10px", padding: "9px 12px",
  fontSize: "13px", fontFamily: "inherit", width: "220px", maxWidth: "100%",
};

export function DangerZone() {
  const [state, action] = useActionState<DeleteAccountState, FormData>(deleteMyAccount, null);
  return (
    <div style={cardStyle}>
      <div style={legendStyle}>Danger zone</div>

      <div style={{ marginBottom: "18px" }}>
        <div style={rowLabelStyle}>Export my data</div>
        <div style={hintStyle}>
          Download everything we hold about you (profile, reviews, generated packages, and
          links to your uploaded résumé files) as a JSON file.
        </div>
        {/* Content-Disposition: attachment on the route triggers the download. */}
        <a href="/api/account/export" style={linkBtnStyle}>Export my data</a>
      </div>

      <div>
        <div style={rowLabelStyle}>Delete my account</div>
        <div style={hintStyle}>
          Permanently deletes your profile, reviews, generated application packages, and
          archived résumé files, and cancels any active subscription. This cannot be undone.
          Type <strong>DELETE</strong> to confirm.
        </div>
        <form action={action} style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="rf-focusable"
            name="confirm"
            placeholder="DELETE"
            autoComplete="off"
            aria-label="Type DELETE to confirm account deletion"
            style={inputStyle}
          />
          <SubmitButton
            pendingLabel="Deleting…"
            style={{
              borderRadius: "10px", padding: "9px 16px", fontSize: "13px",
              background: "var(--danger)", boxShadow: "0 3px 10px rgba(178,59,59,.22)",
            }}
          >
            Delete account
          </SubmitButton>
        </form>
        {state?.error && (
          <p role="alert" style={{ margin: "10px 0 0", fontSize: "12.5px", color: "var(--danger)", fontWeight: 600 }}>
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
