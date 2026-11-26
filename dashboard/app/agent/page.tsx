import type { Metadata } from "next";
import { requireUserId, getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getViewerPlan } from "@/lib/subscriptions";
import { getProfile } from "@/lib/queries";
import { catalogNow } from "@/lib/catalogClock";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { approvalSecret } from "@/lib/agent/approvalSecret";
import { checkBudget, type BudgetState } from "@/lib/agent/budget";
import { loadAppSettings } from "@/lib/appSettings";
import { getDefaultVariant } from "@/lib/agent/settings";
import type { Variant } from "@/lib/agent/config";
import { loadThreadSurfaces, type HostChain, type HostOptions } from "@/lib/agent/surfaces/host";
import { getThread, listThreads, loadMessages } from "@/lib/agent/threads";
import { DEFAULT_THREAD_TITLE } from "@/lib/agent/titles";
import { readActivity } from "@/lib/workspaces/activity";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { AgentChat, CompareStarter, StartConversation } from "@/components/agent/AgentChat";
import { AgentNotice, type AgentBlockingNotice } from "@/components/agent/AgentNotice";
import { AgentPageView } from "@/components/agent/AgentPageView";
import { TestDataBadge } from "@/components/agent/TestDataBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agent · Rolefit" };

// The agent page (plan Tasks 0.14 and 1.20). Everything is read as the signed-in user; a
// thread id in ?t= is only ever read together with that user's id, so another user's
// thread reads as not found. The plan, kill-switch and budget checks here only pick a
// notice: POST /api/agent enforces them again on every send. The render writes nothing
// (previews read the production database): surfaces, their rows and the activity panel
// are reads, and ?compare with no thread open, or the first Send on the empty page,
// starts one from the browser.

async function readBudget(userId: string): Promise<BudgetState> {
  try {
    return await checkBudget(userId);
  } catch {
    // A failed spend read fails closed, like the route.
    return { ok: false, reason: "agent_disabled" };
  }
}

async function readDefaultVariant(userId: string): Promise<Variant> {
  try {
    return await getDefaultVariant(userId);
  } catch {
    // The switcher then shows the column default; a new thread starts in variant 1 too.
    return 1;
  }
}

async function readSurfaces(userId: string, threadId: string, options: HostOptions): Promise<HostChain[]> {
  try {
    return await loadThreadSurfaces(userId, threadId, options);
  } catch (e) {
    // The conversation still shows; its surfaces are missing until a reload works.
    console.error("agent page: surface read failed", e instanceof Error ? e.name : typeof e);
    return [];
  }
}

/** ?compare=a,b: two different well-formed job ids, else null. */
function parseCompare(raw: string | string[] | undefined): readonly [string, string] | null {
  if (typeof raw !== "string") return null;
  const ids = raw.split(",");
  if (ids.length !== 2) return null;
  const [a, b] = ids.map((id) => id.trim());
  if (!JOB_ID_RE.test(a) || !JOB_ID_RE.test(b) || a.length > 300 || b.length > 300 || a === b) return null;
  return [a, b];
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
  const compare = parseCompare(sp.compare);
  const admin = isAdmin(claims);

  const [plan, budget, threads, thread, profile, clock, activity, settings, defaultVariant] = await Promise.all([
    getViewerPlan(userId, claims?.email ?? null),
    readBudget(userId),
    listThreads(userId),
    requested ? getThread(userId, requested) : Promise.resolve(null),
    getProfile(userId).catch(() => null),
    catalogNow(),
    readActivity(userId),
    // loadAppSettings never throws.
    loadAppSettings(),
    readDefaultVariant(userId),
  ]);
  // A variant 3 surface mounts its frame only while the operator switch is on (R15).
  const variant3Enabled = settings.agentVariant3Enabled;
  const [messages, surfaces] = thread
    ? await Promise.all([loadMessages(userId, thread.id), readSurfaces(userId, thread.id, { variant3Enabled })])
    : [[], []];
  const notice: AgentBlockingNotice | null = !plan ? "no_plan" : budget.ok ? null : budget.reason;

  const content = thread ? (
    <AgentChat
      key={thread.id}
      threadId={thread.id}
      title={thread.title}
      initialMessages={messages}
      notice={notice}
      autoTitle={messages.length === 0 && thread.title === DEFAULT_THREAD_TITLE}
      surfaces={surfaces}
      approvalsEnabled={approvalSecret() !== null}
      compare={compare}
      hasProfile={profile !== null}
      variants={plan ? { thread: thread.variant, default: defaultVariant, variant3Enabled } : null}
    />
  ) : compare && notice === null ? (
    <CompareStarter compare={compare} />
  ) : notice === null ? (
    // No conversation open: the empty state with the composer and the upload
    // target; the first Send starts the thread (PR I3b review I4).
    <StartConversation hasProfile={profile !== null} />
  ) : (
    <>
      <AgentNotice kind={notice} />
      <p className="rf-agent-chat__empty">Start a new conversation, or pick one from the list.</p>
    </>
  );

  return (
    <AppShell header={<AppHeader current="agent" email={claims?.email ?? null} isAdmin={admin} />}>
      <AgentPageView
        badge={<TestDataBadge admin={admin} clock={clock} />}
        threads={threads.map((t) => ({ id: t.id, title: t.title }))}
        currentId={thread?.id ?? null}
        notFound={Boolean(requested) && !thread}
        activity={activity}
      >
        {content}
      </AgentPageView>
    </AppShell>
  );
}
