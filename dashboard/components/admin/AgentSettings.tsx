"use client";

import { useState } from "react";
import { saveAgentSettingsAction } from "@/app/actions/adminSettings";
import type { AgentSettingsInput } from "@/lib/appSettings";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/SystemStates";

// Agent kill switches and per-user spend ceilings (rendered inside the isAdmin-gated
// /admin/invites page; the action re-gates independently). Same shape as
// InviteSettings: shared form primitives, layout in .rf-agent-settings-* classes.
// Switches are On/Off selects (FormControls has no toggle). Ceilings are entered in
// dollars and stored in micro-dollars.

const MICROS_PER_DOLLAR = 1_000_000;

/** "" or a non-number becomes NaN, which the action refuses (never a silent $0). */
function dollarsToMicros(text: string): number {
  if (text.trim() === "") return Number.NaN;
  return Math.round(Number(text) * MICROS_PER_DOLLAR);
}

function microsToDollars(micros: number): string {
  return String(micros / MICROS_PER_DOLLAR);
}

function Switch({ id, label, value, onChange }: { id: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <SelectField id={id} label={label} value={value ? "on" : "off"} onChange={(e) => onChange(e.target.value === "on")}>
      <option value="on">On</option>
      <option value="off">Off</option>
    </SelectField>
  );
}

export function AgentSettings({ initial }: { initial: AgentSettingsInput }) {
  const [enabled, setEnabled] = useState(initial.agentEnabled);
  const [background, setBackground] = useState(initial.agentBackgroundEnabled);
  const [variant3, setVariant3] = useState(initial.agentVariant3Enabled);
  const [daily, setDaily] = useState(microsToDollars(initial.agentDailyCeilingMicros));
  const [monthly, setMonthly] = useState(microsToDollars(initial.agentMonthlyCeilingMicros));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await saveAgentSettingsAction({
        agentEnabled: enabled,
        agentBackgroundEnabled: background,
        agentVariant3Enabled: variant3,
        agentDailyCeilingMicros: dollarsToMicros(daily),
        agentMonthlyCeilingMicros: dollarsToMicros(monthly),
      });
      setMessage(res.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: res.error });
    } catch {
      setMessage({ kind: "error", text: "Couldn't save agent settings. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rf-agent-settings-form">
      <div className="rf-agent-settings-fields">
        <Switch id="agent-enabled" label="Agent" value={enabled} onChange={setEnabled} />
        <Switch id="agent-background-enabled" label="Background runs" value={background} onChange={setBackground} />
        <Switch id="agent-variant3-enabled" label="Variant 3" value={variant3} onChange={setVariant3} />
        <TextField
          id="agent-daily-ceiling"
          label="Daily ceiling per user ($)"
          type="number"
          min={0}
          max={1000}
          step={0.01}
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
        />
        <TextField
          id="agent-monthly-ceiling"
          label="Monthly ceiling per user ($)"
          type="number"
          min={0}
          max={1000}
          step={0.01}
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
        />
        <Button type="submit" loading={busy} loadingLabel="Saving agent settings">
          {busy ? "Saving…" : "Save agent settings"}
        </Button>
      </div>
      <p className="rf-agent-settings-note">
        Turning the agent off stops new runs for everyone. Ceilings are per user, in UTC days and
        months; a ceiling of $0 stops all agent spend.
      </p>
      {message && (
        <Alert tone={message.kind === "ok" ? "success" : "danger"} className="rf-agent-settings-message">
          {message.text}
        </Alert>
      )}
    </form>
  );
}
