"use client";

import type { UIMessage } from "ai";
import type { Variant } from "@/lib/agent/config";
import type { HostChain } from "@/lib/agent/surfaces/host";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { AgentChat, StartConversation, type AgentChatFixture } from "./AgentChat";
import { AgentPageView } from "./AgentPageView";
import type { AgentPageFixtureState } from "./agentPageFixtureStates";
import { TestDataBadge } from "./TestDataBadge";
import type { ThreadSummary } from "./ThreadList";
import { FIXTURE_GATHERED, JOBS_FIXTURE_PAYLOAD, JOBS_FIXTURE_ROWS } from "./blocks/AgentBlocksFixture";

// The gallery's agent page fixtures (ui-gallery/states/agent-page-*): the production agent
// page layout and chat with fixed threads, messages and a surface, and no session or
// database. They are in the committed visual-regression suite (tests/visual/routes.ts at
// 390 and 1440, tests/visual/agent-page-widths.spec.ts at 1024, 1280 and 2000), and
// scripts/agent-screens.ts renders them at every width locally. Nothing is sent on load;
// sending from a fixture calls /api/agent like the real page, which only the local script
// stubs (its failed-live state), never the committed suite.

const THREAD = "00000000-0000-4000-8000-0000000000a1";
const SURFACE = "00000000-0000-4000-8000-0000000000b1";
const CLOCK = { now: new Date("2026-10-12T00:00:00.000Z"), frozen: true };

const LONG_TITLE = "What are some jobs that would be interesting as a slight career pivot for me, given my platform background?";

const THREADS: ThreadSummary[] = [
  { id: THREAD, title: LONG_TITLE },
  { id: "00000000-0000-4000-8000-0000000000a2", title: "Compare Acme and Globex" },
  { id: "00000000-0000-4000-8000-0000000000a3", title: "Prep my Acme application" },
  { id: "00000000-0000-4000-8000-0000000000a4", title: "Which roles went stale this week?" },
  { id: "00000000-0000-4000-8000-0000000000a5", title: "New conversation" },
];

const done = { status: "complete" as const, createdAt: "2026-11-25T12:00:00.000Z" };

function user(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }], metadata: done };
}

function assistant(id: string, parts: UIMessage["parts"], status: "complete" | "failed" = "complete"): UIMessage {
  return { id, role: "assistant", parts, metadata: { ...done, status } };
}

const lookup = (callId: string, tool: string) =>
  ({ type: `tool-${tool}`, toolCallId: callId, state: "output-available", input: {}, output: {} }) as UIMessage["parts"][number];

const present = (callId: string) =>
  ({
    type: "tool-present",
    toolCallId: callId,
    state: "output-available",
    input: {},
    output: { surfaceId: SURFACE, variant: 1, outcome: "valid", payload: { variant: 1, blocks: [] } },
  }) as UIMessage["parts"][number];

const CONVERSATION: UIMessage[] = [
  user("u1", LONG_TITLE),
  assistant("a1", [
    lookup("c1", "get_profile_summary"),
    { type: "text", text: "You have eight years of backend and platform work. Three directions build on that without starting over:\n\n1. Developer tooling: internal platforms, CI and build systems.\n2. Data infrastructure: pipelines and storage at scale.\n3. Solutions engineering: customer-facing, but still technical." },
  ]),
  user("u2", "Which of my reviewed jobs fit the first one?"),
  assistant("a2", [
    lookup("c2", "search_jobs"),
    {
      type: "text",
      text: "Two of your reviewed jobs fit developer tooling well.\n\n**Closest matches:**\n- **Acme Systems**, Platform Engineer (fit 88). Remote and lists pay.\n- **Globex**, Build Tools Lead (fit 81). On-site in Austin.\n\nThe Globex review is a month old, so treat its `on-site` note with some caution.",
    },
  ]),
];

const WITH_SURFACE: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [
    lookup("c2", "search_jobs"),
    present("c3"),
    { type: "text", text: "Here are the two closest matches side by side." },
  ]),
];

const FAILED: UIMessage[] = [user("u1", LONG_TITLE), assistant("a1", [], "failed")];

const failedLookup = (callId: string, tool: string) =>
  ({ type: `tool-${tool}`, toolCallId: callId, state: "output-error", input: {}, errorText: "fixture" }) as UIMessage["parts"][number];

const running = (callId: string, tool: string) =>
  ({ type: `tool-${tool}`, toolCallId: callId, state: "input-available", input: {} }) as UIMessage["parts"][number];

// A turn in progress (spec 08 section 14.2): the reply has one search running. Its stored
// status is pending with no start time, so it never reads as interrupted.
const STEPS_WORKING: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  { id: "a2", role: "assistant", parts: [running("s1", "search_jobs")], metadata: { status: "pending" } },
];

// Eight steps: five searches, one posting read, one view built and one review read that
// failed. The view is the fixture chain, so nothing is loaded from the server.
const STEPS_DONE: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [
    ...["s1", "s2", "s3", "s4", "s5"].map((id) => lookup(id, "search_jobs")),
    lookup("s6", "get_job"),
    failedLookup("s7", "get_review"),
    present("s8"),
    { type: "text", text: "Here are the two closest matches side by side. One review could not be read, so its fit score is from the posting alone." },
  ]),
];

const CHAINS: HostChain[] = [
  {
    chainId: SURFACE,
    memberIds: [SURFACE],
    surface: {
      id: SURFACE,
      threadId: THREAD,
      supersedes: null,
      rerenderOf: null,
      createdAt: "2026-11-25T12:00:00.000Z",
      variant: 1,
      view: { kind: "blocks" },
      payload: JOBS_FIXTURE_PAYLOAD,
      gathered: FIXTURE_GATHERED,
      rows: JOBS_FIXTURE_ROWS,
      degraded: false,
      outcome: "valid",
    },
  },
];

const VARIANT_OF: Partial<Record<AgentPageFixtureState, Variant>> = {
  "agent-page-blocks": 1,
  "agent-page-layout": 2,
  "agent-page-code": 3,
};

const MESSAGES_OF: Partial<Record<AgentPageFixtureState, UIMessage[]>> = {
  "agent-page-surface": WITH_SURFACE,
  "agent-page-failed": FAILED,
  "agent-page-steps-working": STEPS_WORKING,
  "agent-page-steps-done": STEPS_DONE,
  "agent-page-steps-open": STEPS_DONE,
};

const WITH_CHAINS: ReadonlySet<AgentPageFixtureState> = new Set(["agent-page-surface", "agent-page-steps-done", "agent-page-steps-open"]);

// The chat's gallery seam: a frozen working timer, or one message's steps open.
const CHAT_FIXTURE_OF: Partial<Record<AgentPageFixtureState, AgentChatFixture>> = {
  "agent-page-steps-working": { working: { elapsedMs: 65_000 } },
  "agent-page-steps-open": { openStepsFor: "a2" },
};

export function AgentPageFixture({ state }: { state: AgentPageFixtureState }) {
  const open = state !== "agent-page-empty";
  const messages = MESSAGES_OF[state] ?? CONVERSATION;
  return (
    <AppShell header={<AppHeader current="agent" email="sam@example.com" isAdmin />}>
      <AgentPageView
        badge={<TestDataBadge admin clock={CLOCK} />}
        threads={open ? THREADS : THREADS.slice(1)}
        currentId={open ? THREAD : null}
        notFound={false}
        activity={[]}
      >
        {open ? (
          <AgentChat
            threadId={THREAD}
            title={LONG_TITLE}
            initialMessages={messages}
            notice={null}
            surfaces={WITH_CHAINS.has(state) ? CHAINS : []}
            hasProfile
            variants={{ thread: VARIANT_OF[state] ?? 1, default: 1, variant3Enabled: true }}
            fixture={CHAT_FIXTURE_OF[state]}
          />
        ) : (
          <StartConversation hasProfile />
        )}
      </AgentPageView>
    </AppShell>
  );
}
