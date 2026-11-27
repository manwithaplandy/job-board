"use client";

// The steps row (spec docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md section
// 7.2): the first child of an assistant message, before every text and view. One toggle
// says what the turn is doing or did; its panel lists the steps grouped by kind. It reads
// as chrome, not as part of the answer.
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatElapsed, stepsHeadline, type StepSummary, type StepsState } from "@/lib/agent/steps";

export function StepsRow({
  id,
  summary,
  state,
  currentLabel = "Thinking",
  elapsedMs = 0,
  open,
  onToggle,
}: {
  /** A page-unique id; the panel's id is `${id}-panel`. */
  id: string;
  summary: StepSummary;
  state: StepsState;
  /** The working row's label (lib/agent/steps.ts currentStepLabel). */
  currentLabel?: string;
  /** Time since the page sent the turn; shown only while working. */
  elapsedMs?: number;
  open: boolean;
  onToggle: () => void;
}) {
  // A finished answer that called no tool has no row at all.
  if (state !== "working" && summary.total === 0) return null;
  const panelId = `${id}-panel`;
  return (
    <div className={`rf-steps rf-steps--${state}`}>
      <Button variant="ghost" size="sm" className="rf-steps__toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        {state === "working" ? (
          <span className="rf-steps__spinner" aria-hidden="true" />
        ) : (
          <Icon name={state === "done" ? "check" : "warning"} size={16} className="rf-steps__icon" />
        )}
        <span className="rf-steps__label">{state === "working" ? currentLabel : stepsHeadline(summary, state)}</span>
        {/* The Send button's status announces the wait; the ticking time is for the eye only. */}
        {state === "working" && (
          <span className="rf-steps__timer" aria-hidden="true">
            {formatElapsed(elapsedMs)}
          </span>
        )}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} className="rf-steps__chevron" />
      </Button>
      <ul id={panelId} className="rf-steps__panel" hidden={!open}>
        {summary.groups.map((g) => (
          <li key={g.key} className="rf-steps__item">
            {g.count > 1 ? `${g.label} (${g.count} times)` : g.label}
            {g.running && <span className="rf-steps__spinner rf-steps__spinner--small" aria-hidden="true" />}
          </li>
        ))}
        {summary.failures.map((line, i) => (
          <li key={`failed-${i}`} className="rf-steps__item rf-steps__item--failed">
            {line}
          </li>
        ))}
        {summary.declined.map((line, i) => (
          <li key={`declined-${i}`} className="rf-steps__item rf-steps__item--declined">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
