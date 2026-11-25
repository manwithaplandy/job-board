"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { undoAgentAction } from "@/app/actions/agent";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import { UNDO_REFUSALS } from "@/components/workspaces/AgentMarker";
import type { ActivityItem } from "@/lib/workspaces/activity";

/** "2026-11-25 14:03 UTC": the same text on the server and in the browser. */
function when(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [undone, setUndone] = useState(item.undone);
  const [message, setMessage] = useState<string | null>(null);
  const undo = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await undoAgentAction(item.id);
        if (result.ok) {
          setUndone(true);
          router.refresh();
        } else setMessage(UNDO_REFUSALS[result.reason]);
      } catch {
        setMessage("Undo failed. Try again.");
      }
    });
  return (
    <li className="rf-ws-activity__row">
      <div className="rf-ws-activity__text">
        <span className="rf-ws-activity__label">{item.label}</span>
        {item.subject && <span className="rf-ws-activity__subject">{item.subject}</span>}
        <time className="rf-ws-activity__time" dateTime={item.createdAt}>
          {when(item.createdAt)}
        </time>
      </div>
      <div className="rf-ws-activity__actions">
        {item.unattended && <Badge tone="neutral">While you were away</Badge>}
        {undone ? (
          <Badge tone="neutral">Undone</Badge>
        ) : (
          <Button variant="ghost" size="sm" onClick={undo} loading={pending} loadingLabel="Undoing">
            Undo
          </Button>
        )}
        {message && (
          <span className="rf-ws-marker__message" role="status">
            {message}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * What the agent changed (spec 6.7), collapsed at the foot of the agent page and each
 * workspace page: newest first, whether it ran while the user was away, and Undo for
 * each change not yet undone. `items` is null when the read failed.
 */
export function ActivityPanel({ items }: { items: ActivityItem[] | null }) {
  return (
    <section className="rf-ws-activity" aria-label="Agent activity">
      <details className="rf-ws-disclosure">
        <summary className="rf-ws-disclosure__summary">
          Agent activity{items && items.length > 0 ? ` (${items.length})` : ""}
        </summary>
        {items === null ? (
          <p className="rf-ws-section__empty">Activity could not be loaded. Reload the page to try again.</p>
        ) : items.length === 0 ? (
          <p className="rf-ws-section__empty">The agent has not changed anything yet.</p>
        ) : (
          <ol className="rf-ws-activity__list">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
