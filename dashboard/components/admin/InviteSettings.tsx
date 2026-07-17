"use client";

import { useState } from "react";
import { saveInviteSettingsAction } from "@/app/actions/adminSettings";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/SystemStates";

// Operator knobs for user-sent invites (rendered inside the isAdmin-gated
// /admin/invites page; the action re-gates independently). NOTE: the comp plan
// applies to ALL invited users — Phase-0/FOUNDER invitees included (one shared
// notion of "invited"; spec 2026-07-13). Built from shared form primitives; layout
// geometry lives in the .rf-invite-settings-* classes (secondary-surfaces.css).

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
    <form onSubmit={submit} className="rf-invite-settings-form">
      <div className="rf-invite-settings-fields">
        <SelectField
          id="invite-comp-plan"
          label="Comped plan for invitees"
          value={compPlan}
          onChange={(e) => setCompPlan(e.target.value)}
        >
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="none">None (no comp)</option>
        </SelectField>
        <TextField
          id="invite-default-allowance"
          label="Default invites/user"
          type="number"
          min={0}
          max={1000}
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
        />
        <Button type="submit" loading={busy} loadingLabel="Saving settings">
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
      <p className="rf-invite-settings-note">
        The comped plan applies to every invited user (Phase-0 invitees included). Changing the
        default only affects users who haven&apos;t spent an invite yet; per-user overrides live on
        the Tenants page.
      </p>
      {message && (
        <Alert tone={message.kind === "ok" ? "success" : "danger"} className="rf-invite-settings-message">
          {message.text}
        </Alert>
      )}
    </form>
  );
}
