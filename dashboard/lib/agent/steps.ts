// The steps row's pure half (spec docs/superpowers/specs/2026-11-27-agent-inline-ui-design.md
// sections 7.1 and 7.2): which of a message's tool parts are steps, how they group, and
// the words the row shows. No React here, so the grouping is unit-tested on its own.
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";
import { toolActivityLabel, toolFailureLabel, toolProgressLabel } from "@/lib/agent/toolLabel";

export type StepLine = { key: string; label: string; count: number; running: boolean };
export type StepSummary = { groups: StepLine[]; failures: string[]; declined: string[]; total: number; failed: number };
export type StepsState = "working" | "done" | "stopped";

type Part = UIMessage["parts"][number];
type ToolPart = Extract<Part, { toolCallId: string }>;

const BUILT = "Built a view";
const REWORKED = "Reworked a view that did not pass checks";
const SIMPLER = "Showed a simpler view instead";

// present's output, read only for its outcome. "limit" is a result kind, never stored.
const presentOutcomeSchema = z.object({ outcome: z.enum(["valid", "repaired", "invalid", "fallback", "limit"]) });

/** A tool part that has no result yet. */
function isRunning(part: ToolPart): boolean {
  return part.state === "input-streaming" || part.state === "input-available";
}

/**
 * Whether a tool part is a step: every tool part except ask_user (its questions are shown
 * in the answer) and an approval still waiting on, or just answered by, the user (the
 * confirm card speaks for it until it ends).
 */
function isStep(part: ToolPart): boolean {
  if (getToolName(part) === "ask_user") return false;
  return part.state !== "approval-requested" && part.state !== "approval-responded";
}

/** The group a finished or running (not failed, not declined) step joins, or null when it is not counted. */
function groupOf(part: ToolPart): { key: string; label: string } | null {
  const name = getToolName(part);
  if (name !== "present") return { key: name, label: toolActivityLabel(name) };
  let label = BUILT;
  if (part.state === "output-available") {
    const outcome = presentOutcomeSchema.safeParse(part.output).data?.outcome;
    if (outcome === "limit") return null;
    if (outcome === "invalid") label = REWORKED;
    else if (outcome === "fallback") label = SIMPLER;
  }
  return { key: `present:${label}`, label };
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The message's steps, grouped by tool (present by its outcome) in first-occurrence order. */
export function summarizeSteps(parts: UIMessage["parts"]): StepSummary {
  const groups: StepLine[] = [];
  const failures: string[] = [];
  const declined: string[] = [];
  for (const part of parts) {
    if (!isToolUIPart(part) || !isStep(part)) continue;
    const name = getToolName(part);
    if (part.state === "output-error") {
      failures.push(toolFailureLabel(name));
      continue;
    }
    if (part.state === "output-denied") {
      declined.push(`You declined: ${lowerFirst(toolActivityLabel(name))}`);
      continue;
    }
    const group = groupOf(part);
    if (!group) continue;
    const line = groups.find((g) => g.key === group.key);
    if (line) {
      line.count += 1;
      line.running ||= isRunning(part);
    } else {
      groups.push({ ...group, count: 1, running: isRunning(part) });
    }
  }
  const counted = groups.reduce((sum, g) => sum + g.count, 0);
  return { groups, failures, declined, total: counted + failures.length + declined.length, failed: failures.length };
}

/** The working row's label: what the turn is doing right now. */
export function currentStepLabel(parts: UIMessage["parts"]): string {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (isToolUIPart(part) && isStep(part) && isRunning(part)) return toolProgressLabel(getToolName(part));
  }
  const last = parts.at(-1);
  if (last && last.type === "text" && last.text.trim() !== "") return "Writing the answer";
  return "Thinking";
}

function steps(n: number): string {
  return n === 1 ? "1 step" : `${n} steps`;
}

/** The collapsed row's text for a finished or stopped turn. */
export function stepsHeadline(summary: StepSummary, state: StepsState): string {
  if (state === "stopped") return `Stopped after ${steps(summary.total)}`;
  const head = `Worked through ${steps(summary.total)}`;
  return summary.failed > 0 ? `${head}, ${summary.failed} did not work` : head;
}

/** Elapsed time as m:ss ("0:00", "1:05", "12:40"); anything not a positive number reads 0:00. */
export function formatElapsed(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
