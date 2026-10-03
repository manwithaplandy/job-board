"use client";
import { useState } from "react";
import { submitFeedback } from "@/app/feedback/actions";
import { FEEDBACK_MAX_LENGTH } from "@/lib/feedback";
import { SelectField, TextArea } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

export function FeedbackForm() {
  const [kind, setKind] = useState("issue");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return <form className="rf-secondary-stack" onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(null); setSent(false);
    try {
      const result = await submitFeedback({kind, message});
      if (result.ok) { setMessage(""); setSent(true); }
      else setError(result.error);
    } catch { setError("Feedback could not be sent. Please try again."); }
    finally { setPending(false); }
  }}>
    <SelectField label="Feedback type" value={kind} onChange={event => setKind(event.target.value)} disabled={pending} required>
      <option value="issue">Issue</option><option value="criticism">Criticism</option><option value="feature_request">Feature request</option>
    </SelectField>
    <TextArea label="Message" description="Up to 4000 characters. Please leave out passwords and sensitive personal information." value={message} onChange={event => setMessage(event.target.value)} maxLength={FEEDBACK_MAX_LENGTH} rows={8} required disabled={pending} />
    <p>You can send up to 5 messages per hour. Your feedback is shared privately with the team.</p>
    {error && <p role="alert">{error}</p>}
    <p role="status" aria-live="polite">{sent ? "Thank you. Your feedback has been received." : ""}</p>
    <Button type="submit" loading={pending} aria-label={pending ? "Sending feedback" : undefined}>Send feedback</Button>
  </form>;
}
