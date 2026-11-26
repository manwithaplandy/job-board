"use client";

import { useId, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { TextArea } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { AGENT_TEXT_MAX } from "@/lib/agent/request";

export const COMPOSER_HINT = "Enter to send, Shift+Enter for a new line.";
export const COMPOSER_PLACEHOLDER = "Ask about your jobs, companies or profile";

/**
 * The message box: one compact bar with the attach control, a text box that grows to a
 * few lines, and Send. Enter sends, Shift+Enter adds a line, blank text never sends. The
 * "Message" label is kept for assistive technology but hidden; the key hint is a small
 * line under the bar that the text box names as its description.
 * `attachments` is the upload target (AttachButton): its control sits at the start of the
 * bar and its file list and errors on the row below (agent.css).
 */
export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  attachments,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled: boolean;
  busy: boolean;
  attachments?: ReactNode;
}) {
  const hintId = useId();
  const blocked = disabled || busy;
  const send = () => {
    if (blocked || value.trim() === "") return;
    onSend(value);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };
  return (
    <form className="rf-agent-composer" onSubmit={onSubmit}>
      <div className={attachments ? "rf-agent-composer__bar rf-agent-composer__bar--attach" : "rf-agent-composer__bar"}>
        {attachments}
        <TextArea
          label="Message"
          visuallyHideLabel
          placeholder={COMPOSER_PLACEHOLDER}
          aria-describedby={hintId}
          className="rf-agent-composer__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={AGENT_TEXT_MAX}
          rows={1}
          disabled={disabled}
        />
        <Button type="submit" className="rf-agent-composer__send" disabled={blocked || value.trim() === ""} loading={busy} loadingLabel="Waiting for the reply">
          Send
        </Button>
      </div>
      <p id={hintId} className="rf-agent-composer__hint">
        {COMPOSER_HINT}
      </p>
    </form>
  );
}
