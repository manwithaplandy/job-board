"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { TextArea } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { AGENT_TEXT_MAX } from "@/lib/agent/request";

/** The message box: Enter sends, Shift+Enter adds a line, blank text never sends. */
export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled: boolean;
  busy: boolean;
}) {
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
      <TextArea
        label="Message"
        description="Enter to send, Shift+Enter for a new line."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        maxLength={AGENT_TEXT_MAX}
        rows={3}
        disabled={disabled}
      />
      <div className="rf-agent-composer__actions">
        <Button type="submit" disabled={blocked || value.trim() === ""} loading={busy} loadingLabel="Waiting for the reply">
          Send
        </Button>
      </div>
    </form>
  );
}
