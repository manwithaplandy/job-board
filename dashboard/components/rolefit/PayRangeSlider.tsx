"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { PAY_CEIL, PAY_FLOOR, PAY_STEP, fmtPayRange } from "@/lib/rolefit/filter";

// Snap an arbitrary $k value onto the slider grid and clamp it to the reachable range.
function snap(n: number): number {
  return Math.min(PAY_CEIL, Math.max(PAY_FLOOR, Math.round(n / PAY_STEP) * PAY_STEP));
}

// Parse a typed pay value into $k. Accepts "120", "120k", "$120k", "120000".
// Empty / "+" / "any" → null (meaningful for the max field: unbounded).
function parsePayInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (s === "" || s === "+" || s === "any") return null;
  const hasK = s.endsWith("k");
  const value = parseFloat(hasK ? s.slice(0, -1) : s);
  if (!Number.isFinite(value)) return null;
  const k = hasK ? value : value >= 1000 ? value / 1000 : value;
  return snap(k);
}

// Percentage position of a $k value along the track.
function pct(k: number): number {
  return ((k - PAY_FLOOR) / (PAY_CEIL - PAY_FLOOR)) * 100;
}

const fmtMinField = (v: number) => (v > 0 ? `$${v}k` : "");
const fmtMaxField = (v: number | null) => (v == null ? "" : `$${v}k`);

export interface PayRangeSliderProps {
  min: number;
  max: number | null;
  includeUndisclosed: boolean;
  onChange: (min: number, max: number | null) => void;
  onToggleUndisclosed: (next: boolean) => void;
}

export function PayRangeSlider({ min, max, includeUndisclosed, onChange, onToggleUndisclosed }: PayRangeSliderProps) {
  const maxPos = max ?? PAY_CEIL;

  // Editable text mirrors of the fields. Resynced from the committed props when they change
  // (slider drag, Clear filters) via the prev-prop render pattern — NOT an effect, which would
  // trip the cascading-render lint. While the user types, the prop is unchanged, so the mirror
  // is left alone; on commit/drag the prop changes and the mirror reformats.
  const [minText, setMinText] = useState(() => fmtMinField(min));
  const [maxText, setMaxText] = useState(() => fmtMaxField(max));
  const [prevMin, setPrevMin] = useState(min);
  const [prevMax, setPrevMax] = useState<number | null>(max);
  if (min !== prevMin) { setPrevMin(min); setMinText(fmtMinField(min)); }
  if (max !== prevMax) { setPrevMax(max); setMaxText(fmtMaxField(max)); }

  const emit = (lo: number, hiPos: number) => onChange(lo, hiPos >= PAY_CEIL ? null : hiPos);
  const onMinRange = (v: number) => emit(Math.min(v, maxPos), maxPos);
  const onMaxRange = (v: number) => emit(min, Math.max(v, min));

  const commitMinText = () => {
    const parsed = parsePayInput(minText);
    emit(Math.min(parsed ?? PAY_FLOOR, maxPos), maxPos);
  };
  const commitMaxText = () => {
    const parsed = parsePayInput(maxText);
    emit(min, parsed == null ? PAY_CEIL : Math.max(parsed, min));
  };
  const onFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
  };

  const summary = fmtPayRange(min, max) ?? "Any pay";
  const fillStyle = { "--rf-pay-fill-start": `${pct(min)}%`, "--rf-pay-fill-end": `${pct(maxPos)}%` } as CSSProperties;

  return (
    <div
      className="rf-pay"
      data-ui-contract-composite="Pay range slider: native range + number inputs keep keyboard/AT support; geometry lives in board.css"
    >
      <div className="rf-pay__summary" aria-live="polite">{summary}</div>

      <div className="rf-pay__slider">
        <div className="rf-pay__track" />
        <div className="rf-pay__fill" data-ui-contract-geometry="track fill is data-driven from the selected range" style={fillStyle} />
        <input
          type="range"
          className="rf-pay__range rf-focusable"
          aria-label="Minimum pay"
          aria-valuetext={min > 0 ? `$${min}k` : "No minimum"}
          min={PAY_FLOOR}
          max={PAY_CEIL}
          step={PAY_STEP}
          value={min}
          onChange={(e) => onMinRange(Number(e.currentTarget.value))}
        />
        <input
          type="range"
          className="rf-pay__range rf-focusable"
          aria-label="Maximum pay"
          aria-valuetext={max == null ? "No maximum" : `$${max}k`}
          min={PAY_FLOOR}
          max={PAY_CEIL}
          step={PAY_STEP}
          value={maxPos}
          onChange={(e) => onMaxRange(Number(e.currentTarget.value))}
        />
      </div>

      <div className="rf-pay__fields">
        <input
          type="text"
          inputMode="numeric"
          className="rf-pay__field rf-focusable"
          aria-label="Minimum pay, in thousands"
          placeholder="$0"
          value={minText}
          onChange={(e) => setMinText(e.currentTarget.value)}
          onBlur={commitMinText}
          onKeyDown={(e) => onFieldKeyDown(e, commitMinText)}
        />
        <span className="rf-pay__dash" aria-hidden="true">–</span>
        <input
          type="text"
          inputMode="numeric"
          className="rf-pay__field rf-focusable"
          aria-label="Maximum pay, in thousands"
          placeholder="+"
          value={maxText}
          onChange={(e) => setMaxText(e.currentTarget.value)}
          onBlur={commitMaxText}
          onKeyDown={(e) => onFieldKeyDown(e, commitMaxText)}
        />
      </div>

      <label className="rf-pay__toggle">
        <input
          type="checkbox"
          className="rf-pay__checkbox rf-focusable"
          checked={includeUndisclosed}
          onChange={(e) => onToggleUndisclosed(e.currentTarget.checked)}
        />
        <span>Include jobs without listed pay</span>
      </label>
    </div>
  );
}
