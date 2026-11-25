"use client";

import { useState } from "react";
import type { Variant } from "@/lib/agent/config";
import { VARIANTS, VARIANT_LABELS, VARIANT3_OFF_NOTE, isVariant, presentVariant } from "@/lib/agent/variants";
import { setDefaultVariantAction, setThreadVariantAction, type VariantChange } from "@/app/actions/agent";
import { SegmentedControl } from "@/components/ui/Navigation";
import { Button } from "@/components/ui/Button";

// The per-thread variant switcher (plan Task 2.8, spec 7.2). Any signed-in user with a plan
// sees all three options: there is no admin check (Andrew 2026-11-19). The page passes no
// state without a plan, and the server actions check the plan again. While the operator
// switch agentVariant3Enabled is off, option 3 is disabled with a fixed note, and a thread
// recorded as variant 3 shows (and presents) as variant 1; its recorded variant is kept.
// A change applies from the next turn: surfaces already shown keep the variant on their row.

export interface VariantsState {
  /** The thread's recorded variant. */
  thread: Variant;
  /** The user's default for new threads (agent_settings.default_variant). */
  default: Variant;
  variant3Enabled: boolean;
}

export const SWITCHER_LABEL = "Layout for this conversation";
export const SWITCHER_APPLIES = "Applies from your next message.";
export const SWITCHER_FAILED = "The layout could not be changed. Try again.";
export const USE_AS_DEFAULT = "Use for new conversations";
export const IS_DEFAULT = "Used for new conversations";

function failureText(result: VariantChange): string | null {
  if (result.ok) return null;
  if (result.reason === "variant3_off") return VARIANT3_OFF_NOTE;
  return SWITCHER_FAILED;
}

export function VariantSwitcher({ threadId, state, disabled = false }: { threadId: string; state: VariantsState; disabled?: boolean }) {
  const [recorded, setRecorded] = useState<Variant>(state.thread);
  const [defaultVariant, setDefault] = useState<Variant>(state.default);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const shown = presentVariant(recorded, state.variant3Enabled);

  const pick = (raw: string) => {
    const next = Number(raw);
    if (!isVariant(next) || next === shown || busy) return;
    if (next === 3 && !state.variant3Enabled) return;
    const before = recorded;
    setRecorded(next);
    setBusy(true);
    setMessage(null);
    void setThreadVariantAction(threadId, next).then(
      (result) => {
        if (!result.ok) setRecorded(before);
        setMessage(failureText(result) ?? SWITCHER_APPLIES);
      },
      () => {
        setRecorded(before);
        setMessage(SWITCHER_FAILED);
      },
    ).finally(() => setBusy(false));
  };

  const makeDefault = () => {
    if (busy || shown === defaultVariant) return;
    const before = defaultVariant;
    setDefault(shown);
    setBusy(true);
    setMessage(null);
    void setDefaultVariantAction(shown).then(
      (result) => {
        if (!result.ok) {
          setDefault(before);
          setMessage(failureText(result));
        }
      },
      () => {
        setDefault(before);
        setMessage(SWITCHER_FAILED);
      },
    ).finally(() => setBusy(false));
  };

  return (
    <div className="rf-agent-variants">
      <div className="rf-agent-variants__row">
        <SegmentedControl
          label={SWITCHER_LABEL}
          value={String(shown)}
          onChange={pick}
          items={VARIANTS.map((v) => ({
            label: VARIANT_LABELS[v],
            value: String(v),
            // Not disabled while a change saves (that would drop the focus); pick ignores it.
            disabled: disabled || (v === 3 && !state.variant3Enabled),
          }))}
        />
        <Button variant="ghost" size="sm" onClick={makeDefault} disabled={disabled || busy || shown === defaultVariant}>
          {shown === defaultVariant ? IS_DEFAULT : USE_AS_DEFAULT}
        </Button>
      </div>
      {!state.variant3Enabled && <p className="rf-agent-variants__note">{VARIANT3_OFF_NOTE}</p>}
      <p className="rf-agent-variants__status" role="status">
        {message && !(message === VARIANT3_OFF_NOTE && !state.variant3Enabled) ? message : ""}
      </p>
    </div>
  );
}
