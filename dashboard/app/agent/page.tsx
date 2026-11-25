import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getViewerPlan } from "@/lib/subscriptions";
import { checkBudget, type BudgetState } from "@/lib/agent/budget";
import { getThread, listThreads, loadMessages } from "@/lib/agent/threads";
import { DEFAULT_THREAD_TITLE } from "@/lib/agent/titles";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageHeader } from "@/components/ui/Navigation";
import { Alert } from "@/components/ui/SystemStates";
import { AgentChat } from "@/components/agent/AgentChat";
import { AgentNotice, type AgentBlockingNotice } from "@/components/agent/AgentNotice";
import { ThreadList } from "@/components/agent/ThreadList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent · Rolefit" };

// The minimal, text-only agent page (plan Task 0.14). Everything is read as the signed-in
// user; a thread id in ?t= is only ever read together with that user's id, so another
// user's thread reads as not found. The plan, kill-switch and budget checks here only
// pick a notice: POST /api/agent enforces them again on every send.

async function readBudget(userId: string): Promise<BudgetState> {
  try {
    return await checkBudget(userId);
  } catch {
    // A failed spend read fails closed, like the route.
    return { ok: false, reason: "agent_disabled" };
  }
}

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUserId();
  const claims = await getUserClaims();
  const sp = await searchParams;
  const requested = typeof sp.t === "string" ? sp.t : null;

  const [plan, budget, threads, thread] = await Promise.all([
    getViewerPlan(userId, claims?.email ?? null),
    readBudget(userId),
    listThreads(userId),
    requested ? getThread(userId, requested) : Promise.resolve(null),
  ]);
  const messages = thread ? await loadMessages(userId, thread.id) : [];
  const notice: AgentBlockingNotice | null = !plan ? "no_plan" : budget.ok ? null : budget.reason;

  return (
    <AppShell header={<AppHeader current="agent" email={claims?.email ?? null} isAdmin={isAdmin(claims)} />}>
      <main className="rf-secondary-page">
        <div className="rf-secondary-wrap rf-secondary-wrap--wide rf-secondary-stack">
          <PageHeader title="Agent" description="Ask about your reviewed jobs, companies and profile." />
          <div className="rf-agent-layout">
            <ThreadList threads={threads.map((t) => ({ id: t.id, title: t.title }))} currentId={thread?.id ?? null} />
            <div className="rf-agent-main">
              {requested && !thread && <Alert tone="warning">This conversation was not found. Pick one from the list or start a new one.</Alert>}
              {thread ? (
                <AgentChat
                  key={thread.id}
                  threadId={thread.id}
                  initialMessages={messages}
                  notice={notice}
                  autoTitle={messages.length === 0 && thread.title === DEFAULT_THREAD_TITLE}
                />
              ) : (
                <>
                  {notice && <AgentNotice kind={notice} />}
                  <p className="rf-agent-chat__empty">Start a new conversation, or pick one from the list.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
