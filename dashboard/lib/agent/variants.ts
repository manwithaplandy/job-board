// The three layout variants as the switcher and "Re-render as" offer them (plan Tasks 2.8
// and 2.9, spec 7.2). Client-safe: constants and pure functions only.
//
// agentVariant3Enabled (lib/appSettings.ts) is an operator kill switch that only Andrew
// flips; no code here changes it. While it is false, option 3 is shown disabled with
// VARIANT3_OFF_NOTE, a thread recorded as variant 3 presents as variant 1
// (presentVariant), and stored variant 3 surfaces show their variant 1 fallback.
import type { Variant } from "@/lib/agent/config";

export const VARIANTS: readonly Variant[] = [1, 2, 3];

/** Short names for the switcher and the re-render tabs. */
export const VARIANT_LABELS: Record<Variant, string> = {
  1: "Blocks",
  2: "Layout",
  3: "Code",
};

/** The fixed note beside the disabled option 3 while the operator switch is off. */
export const VARIANT3_OFF_NOTE = "Code views are switched off for now. Conversations set to Code show Blocks instead.";

export function isVariant(value: unknown): value is Variant {
  return value === 1 || value === 2 || value === 3;
}

/**
 * The variant a turn presents in: the thread's recorded variant, except that a variant 3
 * thread presents as variant 1 while variant 3 is switched off.
 */
export function presentVariant(recorded: Variant, variant3Enabled: boolean): Variant {
  return recorded === 3 && !variant3Enabled ? 1 : recorded;
}
