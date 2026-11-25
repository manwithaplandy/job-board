"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/FormControls";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { BlockFrame } from "./shared";
import type { OnIntent } from "./types";

type IntakeQuestions = Extract<V1Block, { type: "IntakeQuestions" }>;
type Question = IntakeQuestions["questions"][number];
type Value = string | string[];

/** The answer intent's caps (ANSWER_MAX and its 20 values in lib/agent/actions/intents.ts). */
export const INTAKE_ANSWER_MAX = 2000;
const VALUES_MAX = 20;

function locations(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(0, VALUES_MAX);
}

/** The answer to send, or null while the question is unanswered. */
function answerOf(q: Question, raw: Value | undefined): Value | null {
  if (q.kind === "text") return typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, INTAKE_ANSWER_MAX) : null;
  if (q.kind === "locations") {
    const list = typeof raw === "string" ? locations(raw) : [];
    return list.length > 0 ? list : null;
  }
  if (q.kind === "choice") return typeof raw === "string" && raw !== "" ? raw : null;
  return Array.isArray(raw) && raw.length > 0 ? raw : null;
}

function OptionGroup({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: Value | undefined;
  disabled: boolean;
  onChange: (value: Value) => void;
}) {
  const labelId = useId();
  const many = question.kind === "multi";
  const picked = Array.isArray(value) ? value : typeof value === "string" && value !== "" ? [value] : [];
  return (
    <div className="rf-block-intake__options">
      <p id={labelId} className="rf-block-intake__label">
        {question.label}
      </p>
      <div className="rf-block__actions" role="group" aria-labelledby={labelId}>
        {/* The grammar refuses duplicate options; the index keeps keys unique regardless. */}
        {(question.options ?? []).map((option, i) => {
          const on = picked.includes(option);
          return (
            <Button
              key={`${i}:${option}`}
              variant={on ? "secondary" : "outline"}
              size="sm"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => {
                if (!many) onChange(on ? "" : option);
                else onChange(on ? picked.filter((p) => p !== option) : [...picked, option].slice(0, VALUES_MAX));
              }}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The agent's short intake (spec 5(a) step 4). Labels and options are the agent's plain
 * text; the answers are the user's own, typed or picked in fixed controls. Send answers
 * is enabled once every question has an answer and emits one answer intent per
 * question, in order.
 */
export function IntakeQuestionsBlock({ block, onIntent }: { block: IntakeQuestions; onIntent: OnIntent }) {
  const formId = useId();
  const [values, setValues] = useState<Record<string, Value>>({});
  const [sent, setSent] = useState(false);
  const set = (id: string, value: Value) => setValues((v) => ({ ...v, [id]: value }));
  const answers = block.questions.map((q) => answerOf(q, values[q.id]));
  const complete = answers.every((a) => a !== null);
  const submit = () => {
    if (!complete || sent) return;
    block.questions.forEach((q, i) => {
      const value = answers[i];
      if (value !== null) onIntent({ name: "answer", questionId: q.id, value });
    });
    setSent(true);
  };
  return (
    <BlockFrame title="A few questions" className="rf-block-intake">
      <div className="rf-block-intake__questions">
        {block.questions.map((q) => {
          const raw = values[q.id];
          const id = `${formId}-${q.id}`;
          if (q.kind === "choice" || q.kind === "multi") {
            return <OptionGroup key={q.id} question={q} value={raw} disabled={sent} onChange={(v) => set(q.id, v)} />;
          }
          if (q.kind === "locations") {
            return (
              <TextArea
                key={q.id}
                id={id}
                label={q.label}
                description="One place per line."
                rows={3}
                maxLength={INTAKE_ANSWER_MAX}
                disabled={sent}
                value={typeof raw === "string" ? raw : ""}
                onChange={(e) => set(q.id, e.currentTarget.value)}
              />
            );
          }
          return (
            <TextField
              key={q.id}
              id={id}
              label={q.label}
              maxLength={INTAKE_ANSWER_MAX}
              disabled={sent}
              value={typeof raw === "string" ? raw : ""}
              onChange={(e) => set(q.id, e.currentTarget.value)}
            />
          );
        })}
      </div>
      <div className="rf-block__actions">
        <Button disabled={!complete || sent} onClick={submit}>
          {sent ? "Answers sent" : "Send answers"}
        </Button>
      </div>
    </BlockFrame>
  );
}
