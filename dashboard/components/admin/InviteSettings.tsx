"use client";

import { useState } from "react";
import { saveInviteSettingsAction } from "@/app/actions/adminSettings";

// Operator knobs for user-sent invites (rendered inside the isAdmin-gated
// /admin/invites page; the action re-gates independently). NOTE: the comp plan
// applies to ALL invited users — Phase-0/FOUNDER invitees included (one shared
// notion of "invited"; spec 2026-07-13).

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "4px",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", fontSize: "13px", color: "var(--text-primary)",
  background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "9px",
  padding: "8px 10px", fontFamily: "inherit",
};

export function InviteSettings({
  initialCompPlan,
  initialDefaultAllowance,
}: {
  initialCompPlan: "standard" | "pro" | "none";
  initialDefaultAllowance: number;
}) {
  const [compPlan, setCompPlan] = useState<string>(initialCompPlan);
  const [allowance, setAllowance] = useState(String(initialDefaultAllowance));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveInviteSettingsAction({
        compPlan,
        defaultAllowance: Number(allowance),
      });
      setMessage(res.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: res.error });
    } catch {
      setMessage({ kind: "error", text: "Couldn't save settings. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 180px" }}>
          <label htmlFor="invite-comp-plan" style={labelStyle}>Comped plan for invitees</label>
          <select
            id="invite-comp-plan"
            value={compPlan}
            onChange={(e) => setCompPlan(e.target.value)}
            style={inputStyle}
          >
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="none">None (no comp)</option>
          </select>
        </div>
        <div style={{ flex: "0 0 150px" }}>
          <label htmlFor="invite-default-allowance" style={labelStyle}>Default invites/user</label>
          <input
            id="invite-default-allowance"
            type="number"
            min={0}
            max={1000}
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "13px",
            fontWeight: 700, color: "var(--text-on-accent)", background: "var(--accent)",
            boxShadow: "var(--shadow-accent)", cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1, fontFamily: "inherit", flexShrink: 0,
          }}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
      <div style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--text-muted)" }}>
        The comped plan applies to every invited user (Phase-0 invitees included). Changing the
        default only affects users who haven&apos;t spent an invite yet; per-user overrides live on
        the Tenants page.
      </div>
      {message && (
        <div
          style={{
            marginTop: "10px", fontSize: "12.5px",
            color: message.kind === "ok" ? "var(--accent)" : "var(--danger)",
          }}
        >
          {message.text}
        </div>
      )}
    </form>
  );
}
