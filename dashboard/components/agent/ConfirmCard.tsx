"use client";

import { Button } from "@/components/ui/Button";
import type { ConfirmDescriptor } from "@/lib/agent/actions/intents";

/**
 * The one UI for tool approvals and high-risk intents (plan Task 1.20, spec section 10
 * "Non-generative confirmation"). Every word comes from the descriptor that
 * describeConfirmation built from database values and fixed labels: the title, the
 * lines, the proposed values and the confirm button. The proposed values (what the
 * user is approving) sit under a fixed "Proposed" label, apart from the database lines,
 * as plain text. Only "Cancel" is this component's own.
 */
export function ConfirmCard({
  descriptor,
  onApprove,
  onDeny,
  busy = false,
}: {
  descriptor: ConfirmDescriptor;
  onApprove: () => void;
  onDeny: () => void;
  busy?: boolean;
}) {
  const proposed = descriptor.proposed ?? [];
  return (
    <section className="rf-agent-confirm" role="group" aria-label={descriptor.title}>
      <h2 className="rf-agent-confirm__title">{descriptor.title}</h2>
      {descriptor.lines.length > 0 && (
        <ul className="rf-agent-confirm__lines">
          {descriptor.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {proposed.length > 0 && (
        <div className="rf-agent-confirm__proposed">
          <p className="rf-agent-confirm__label">Proposed</p>
          <ul className="rf-agent-confirm__lines">
            {proposed.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rf-agent-confirm__actions">
        <Button variant={descriptor.danger ? "destructive" : "primary"} onClick={onApprove} disabled={busy} loading={busy} loadingLabel="Working">
          {descriptor.confirmLabel}
        </Button>
        <Button variant="outline" onClick={onDeny} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
