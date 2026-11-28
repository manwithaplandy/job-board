"use client";

import type { UIMessage } from "ai";
import type { Variant } from "@/lib/agent/config";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import type { SurfacePayloadV3 } from "@/lib/agent/surfaces/v3/document";
import type { PresentToolOutput } from "@/lib/agent/tools/present";
import { AppShell } from "@/components/shell/AppShell";
import { AppHeader } from "@/components/shell/AppHeader";
import { AgentChat, StartConversation, type AgentChatFixture } from "./AgentChat";
import { AgentPageView } from "./AgentPageView";
import type { AgentPageFixtureState } from "./agentPageFixtureStates";
import { TestDataBadge } from "./TestDataBadge";
import type { ThreadSummary } from "./ThreadList";
import { FIXTURE_GATHERED, JOBS_FIXTURE_PAYLOAD, JOBS_FIXTURE_ROWS, PREP_FIXTURE_GATHERED, PREP_FIXTURE_ROWS } from "./blocks/AgentBlocksFixture";
import { sandboxChain } from "./SurfaceHost";

// The gallery's agent page fixtures (ui-gallery/states/agent-page-*): the production agent
// page layout and chat with fixed threads, messages and a surface, and no session or
// database. They are in the committed visual-regression suite (tests/visual/routes.ts at
// 390 and 1440, tests/visual/agent-page-widths.spec.ts at 375, 768, 1024, 1280, 1440 and
// 2000 for the inline-view, steps and expanded states), and
// scripts/agent-screens.ts renders them at every width locally. Nothing is sent on load;
// sending from a fixture calls /api/agent like the real page, which only the local script
// stubs (its failed-live state), never the committed suite.

const THREAD = "00000000-0000-4000-8000-0000000000a1";
const SURFACE = "00000000-0000-4000-8000-0000000000b1";
// The update of SURFACE in agent-page-view-updated.
const SURFACE_UPDATED = "00000000-0000-4000-8000-0000000000b2";
// The variant 3 (code) view of agent-page-code-expanded.
const SURFACE_CODE = "00000000-0000-4000-8000-0000000000b3";
// The second view of agent-page-views-multi.
const SURFACE_SECOND = "00000000-0000-4000-8000-0000000000b4";
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

// A stored present call, its output as the tool returns it: no payload (spec 08 S4.4).
const present = (callId: string, surfaceId: string = SURFACE, variant: Variant = 1) => {
  const output: PresentToolOutput = { surfaceId, variant, outcome: "valid" };
  return { type: "tool-present", toolCallId: callId, state: "output-available", input: {}, output } as UIMessage["parts"][number];
};

/** A present call whose input is still arriving: its view is being built. */
const building = (callId: string) =>
  ({ type: "tool-present", toolCallId: callId, state: "input-available", input: {} }) as UIMessage["parts"][number];

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

// A view in progress (spec 08 S7.3): the reply says what the view is for, the present call
// is still arriving, and the answer goes on. Pending with no start time, like
// STEPS_WORKING, so it never reads as interrupted.
const VIEW_BUILDING: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  {
    id: "a2",
    role: "assistant",
    parts: [
      lookup("b1", "search_jobs"),
      { type: "text", text: "Two of your reviewed jobs fit developer tooling. Here they are side by side:" },
      building("b2"),
      { type: "text", text: "Acme pays more; Globex is on-site in Austin." },
    ],
    metadata: { status: "pending" },
  },
];

// An updated view (spec 08 S4.1): the older reply named the chain's first row, so it shows
// the "updated below" stub; the newer reply names the update and shows the view.
const VIEW_UPDATED: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [lookup("c2", "search_jobs"), { type: "text", text: "Here are the two closest matches side by side." }, present("c3")]),
  user("u3", "Put the one that lists pay first."),
  assistant("a3", [{ type: "text", text: "Done: Acme lists pay, so it comes first now." }, present("c4", SURFACE_UPDATED)]),
];

// A layout (variant 2) view whose tree could not be built: its row holds the blocks
// fallback with outcome fallback, so it shows blocks with the caption (spec 08 S11).
const VIEW_DEGRADED: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [lookup("c2", "search_jobs"), { type: "text", text: "Here are the two closest matches side by side." }, present("c3", SURFACE, 2)]),
];

// A code (variant 3) view (spec 08 S14.2, agent-page-code-expanded): the same two jobs as
// the blocks view. Its document is static: no script, so it calls no action and makes no
// request; the kit's handshake still runs, as for any generated view.
const CODE_REPLY: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [
    lookup("c2", "search_jobs"),
    { type: "text", text: "Here are the two closest matches side by side." },
    present("c3", SURFACE_CODE, 3),
  ]),
];

// Two views in one reply (spec 08 S4.1, S4.4): text, view, text, view, text, in stored
// order. The first is the jobs view; the second shows something different, the user's
// application numbers.
const VIEWS_MULTI: UIMessage[] = [
  ...CONVERSATION.slice(0, 3),
  assistant("a2", [
    lookup("c2", "search_jobs"),
    lookup("c3", "query_metrics"),
    { type: "text", text: "Two of your reviewed jobs fit developer tooling. Here they are side by side:" },
    present("c4"),
    { type: "text", text: "Acme pays more and is remote, so it comes first. For context, here is how your applications are going:" },
    present("c5", SURFACE_SECOND),
    { type: "text", text: "Most of your applications are still at **applied**, so I would start the Acme prep this week." },
  ]),
];

export const CODE_FIXTURE_DOCUMENT: SurfacePayloadV3 = {
  variant: 3,
  title: "Two developer tooling matches",
  html: `<style>
.cmp { display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.cmp h2 { margin: 0 0 var(--space-1); font-size: var(--font-size-body); overflow-wrap: anywhere; }
.cmp p { margin: var(--space-1) 0; }
</style>
<h1>Two developer tooling matches</h1>
<p class="jb-secondary">Acme lists pay and is remote; Globex is on-site in Austin.</p>
<div class="cmp">
<section class="jb-card"><h2>Senior Product Engineer</h2><p>Acme Systems</p><p><span class="jb-badge jb-success">Fit 84</span></p><p class="jb-muted jb-small">Remote</p></section>
<section class="jb-card"><h2>Staff Backend Engineer</h2><p>Globex</p><p><span class="jb-badge jb-accent">Fit 71</span></p><p class="jb-muted jb-small">Austin, TX, on-site</p></section>
</div>`,
};

// Built the way the sandbox harness builds a case (sandboxChain over a SandboxSurface),
// with the blocks view's payload as its stored fallback.
const CODE_CHAINS: HostChain[] = [
  sandboxChain({ id: SURFACE_CODE, threadId: THREAD, payload: CODE_FIXTURE_DOCUMENT, gathered: FIXTURE_GATHERED, fallback: JOBS_FIXTURE_PAYLOAD, rows: JOBS_FIXTURE_ROWS }),
];

const FIXTURE_SURFACE: HostSurface = {
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
};

const CHAINS: HostChain[] = [{ chainId: SURFACE, memberIds: [SURFACE], surface: FIXTURE_SURFACE }];

const UPDATED_CHAINS: HostChain[] = [
  {
    chainId: SURFACE,
    memberIds: [SURFACE, SURFACE_UPDATED],
    surface: { ...FIXTURE_SURFACE, id: SURFACE_UPDATED, supersedes: SURFACE, createdAt: "2026-11-25T12:05:00.000Z" },
  },
];

const MULTI_CHAINS: HostChain[] = [
  ...CHAINS,
  {
    chainId: SURFACE_SECOND,
    memberIds: [SURFACE_SECOND],
    surface: {
      ...FIXTURE_SURFACE,
      id: SURFACE_SECOND,
      createdAt: "2026-11-25T12:00:01.000Z",
      payload: {
        variant: 1,
        title: "How your applications are going",
        blocks: [
          { type: "StatRow", metricRefs: [0, 2] },
          { type: "MetricChart", metricRef: 3, viz: "bar", title: "Where your applications are" },
        ],
      },
      gathered: PREP_FIXTURE_GATHERED,
      rows: PREP_FIXTURE_ROWS,
    },
  },
];

const DEGRADED_CHAINS: HostChain[] = [{ chainId: SURFACE, memberIds: [SURFACE], surface: { ...FIXTURE_SURFACE, variant: 2, outcome: "fallback" } }];

const VARIANT_OF: Partial<Record<AgentPageFixtureState, Variant>> = {
  "agent-page-blocks": 1,
  "agent-page-layout": 2,
  "agent-page-code": 3,
  "agent-page-view-degraded": 2,
  "agent-page-code-expanded": 3,
};

const MESSAGES_OF: Partial<Record<AgentPageFixtureState, UIMessage[]>> = {
  "agent-page-surface": WITH_SURFACE,
  "agent-page-failed": FAILED,
  "agent-page-steps-working": STEPS_WORKING,
  "agent-page-steps-done": STEPS_DONE,
  "agent-page-steps-open": STEPS_DONE,
  "agent-page-view-building": VIEW_BUILDING,
  "agent-page-view-updated": VIEW_UPDATED,
  "agent-page-view-degraded": VIEW_DEGRADED,
  "agent-page-view-expanded": WITH_SURFACE,
  "agent-page-code-expanded": CODE_REPLY,
  "agent-page-views-multi": VIEWS_MULTI,
};

const CHAINS_OF: Partial<Record<AgentPageFixtureState, HostChain[]>> = {
  "agent-page-surface": CHAINS,
  "agent-page-steps-done": CHAINS,
  "agent-page-steps-open": CHAINS,
  "agent-page-view-updated": UPDATED_CHAINS,
  "agent-page-view-degraded": DEGRADED_CHAINS,
  "agent-page-view-expanded": CHAINS,
  "agent-page-code-expanded": CODE_CHAINS,
  "agent-page-views-multi": MULTI_CHAINS,
};

// The chat's gallery seam: a frozen working timer, one message's steps open, or a view
// expanded with the dock (no history entry is pushed for it).
const CHAT_FIXTURE_OF: Partial<Record<AgentPageFixtureState, AgentChatFixture>> = {
  "agent-page-steps-working": { working: { elapsedMs: 65_000 } },
  "agent-page-steps-open": { openStepsFor: "a2" },
  "agent-page-view-building": { working: { elapsedMs: 12_000 } },
  "agent-page-view-expanded": { expandedChainId: SURFACE },
  "agent-page-code-expanded": { expandedChainId: SURFACE_CODE },
};

/** The messages a state's chat starts with (exported for its test). */
export function agentPageFixtureMessages(state: AgentPageFixtureState): UIMessage[] {
  return MESSAGES_OF[state] ?? CONVERSATION;
}

export function AgentPageFixture({ state }: { state: AgentPageFixtureState }) {
  const open = state !== "agent-page-empty";
  const messages = agentPageFixtureMessages(state);
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
            surfaces={CHAINS_OF[state] ?? []}
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
