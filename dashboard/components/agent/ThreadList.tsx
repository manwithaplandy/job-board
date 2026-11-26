"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { newThread } from "@/app/actions/agent";
import { Button, ButtonLink } from "@/components/ui/Button";

export type ThreadSummary = { id: string; title: string };

/** The caller's conversations, newest first, and the button that starts a new one. */
export function ThreadList({ threads, currentId }: { threads: ThreadSummary[]; currentId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const start = () =>
    startTransition(async () => {
      setFailed(false);
      try {
        const { id } = await newThread();
        router.push(`/agent?t=${encodeURIComponent(id)}`);
      } catch {
        setFailed(true);
      }
    });
  return (
    <nav className="rf-agent-threads" aria-label="Conversations">
      <Button onClick={start} loading={pending} loadingLabel="Starting a conversation" className="rf-agent-threads__new">
        New conversation
      </Button>
      {failed && <p role="alert" className="rf-agent-threads__error">A new conversation could not be started. Try again.</p>}
      {threads.length > 0 && <h2 className="rf-agent-threads__heading">Conversations</h2>}
      {threads.length > 0 && (
        <ul className="rf-agent-threads__list">
          {threads.map((t) => (
            <li key={t.id}>
              <ButtonLink
                href={`/agent?t=${encodeURIComponent(t.id)}`}
                variant="ghost"
                className="rf-agent-threads__item"
                aria-current={t.id === currentId ? "page" : undefined}
                title={t.title}
              >
                {/* The title truncates inside the column (agent.css); the link keeps its full name. */}
                <span className="rf-agent-threads__title">{t.title}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
