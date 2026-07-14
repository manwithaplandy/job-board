// Native tier-aware <select> for the per-task reasoning-effort setting (Profile).
// "" = Off (the default; stored as NULL). Medium/High render disabled with a
// "(Pro)" suffix on non-Pro plans — the save action re-validates server-side
// (validateReasoningEffort), so the disabled attributes are UX, not the gate.
const LEVELS: { value: "" | "low" | "medium" | "high"; label: string; pro: boolean }[] = [
  { value: "", label: "Off (default)", pro: false },
  { value: "low", label: "Low", pro: false },
  { value: "medium", label: "Medium", pro: true },
  { value: "high", label: "High", pro: true },
];

export function ReasoningEffortSelect({
  label, name, defaultValue, isPro,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  isPro: boolean;
}) {
  const selectId = `reasoning-effort-${name}`;
  // A SELECTED option that is disabled is NOT submitted by browsers (WHATWG
  // form entry-list algorithm), so a downgraded Pro→Standard user with a stored
  // "medium"/"high" would submit no reasoning_effort field on save → NULL (Off),
  // silently resetting their setting. Render the clamped value the call-time
  // clamp (resolveReasoningEffort) already applies at generation time, so the
  // form round-trips what generation actually uses.
  const stored = defaultValue ?? "";
  const selected = !isPro && (stored === "medium" || stored === "high") ? "low" : stored;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label htmlFor={selectId} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
      </label>
      <span style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--text-secondary)", marginTop: "3px" }}>
        {isPro
          ? "How hard the model thinks before writing. Off is cheapest and fastest."
          : "Off or Low on Standard — Medium and High need Pro."}
      </span>
      <select
        id={selectId}
        name={name}
        defaultValue={selected}
        className="rf-control rf-select rf-focusable"
        style={{
          marginTop: "8px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          padding: "11px 12px",
          fontSize: "13px",
          color: "var(--text-primary)",
          background: "var(--bg-surface)",
          fontFamily: "inherit",
        }}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value} disabled={l.pro && !isPro}>
            {l.label + (l.pro && !isPro ? " (Pro)" : "")}
          </option>
        ))}
      </select>
    </div>
  );
}
