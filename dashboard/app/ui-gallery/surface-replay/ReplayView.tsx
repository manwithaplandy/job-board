"use client";

// The client half of the replay page (plan Task 2.11): one surface through the renderer the
// host would pick (BlockList, TreeRenderer or SandboxFrame), with presses and fallbacks
// written to <output data-replay-log="..."> for the render smoke to read. Nothing a press
// asks for runs: intents are only logged, and the frame's stub describes no chip. Every
// view sits in the page's view frame (ViewFrame, spec 08 S5, plan D9) as on the agent page,
// with its Expand button, so the render smoke checks each surface inline and expanded
// (spec 08 S15.2 layer 4). The page holds the expanded state itself, without a history entry.
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { BlockList } from "@/components/agent/blocks/BlockList";
import { TreeRenderer } from "@/components/agent/tree/TreeRenderer";
import { SandboxFrame, type SandboxFrameServer, type SandboxSurface } from "@/components/agent/sandbox/SandboxFrame";
import { sandboxChain } from "@/components/agent/SurfaceHost";
import { ViewFrame } from "@/components/agent/ViewFrame";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { HostChain, SurfaceView } from "@/lib/agent/surfaces/host";
import type { SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";

export function ReplayView({
  name,
  variant,
  surfaceId,
  threadId,
  title,
  view,
  payload,
  gathered,
  degraded,
}: {
  name: string;
  variant: 1 | 2 | 3;
  surfaceId: string;
  threadId: string;
  title: string;
  view: SurfaceView;
  payload: SurfacePayloadV1;
  gathered: GatheredData;
  degraded: boolean;
}) {
  const [intents, setIntents] = useState<unknown[]>([]);
  const [fallbacks, setFallbacks] = useState<unknown[]>([]);
  const [expanded, setExpanded] = useState(false);
  const collapse = useCallback(() => setExpanded(false), []);
  const log = (intent: ActionIntent) => setIntents((l) => [...l, intent]);
  const server = useMemo<SandboxFrameServer>(
    () => ({
      describe: async () => null,
      report: async () => null,
    }),
    [],
  );
  const sandbox: SandboxSurface | null =
    view.kind === "sandbox" ? { id: surfaceId, threadId, payload: view.document, gathered, fallback: payload, rows: {} } : null;
  const chain: HostChain = sandbox
    ? sandboxChain(sandbox)
    : {
        chainId: surfaceId,
        memberIds: [surfaceId],
        surface: { id: surfaceId, threadId, supersedes: null, rerenderOf: null, createdAt: "1970-01-01T00:00:00.000Z", variant, view, payload, gathered, rows: {}, degraded, outcome: "valid" },
      };

  return (
    <main
      className="rf-gallery"
      data-surface-replay={name}
      data-replay-variant={variant}
      data-replay-view={view.kind}
      data-replay-degraded={degraded ? "yes" : "no"}
    >
      <div className="rf-gallery__intro">
        <h1>{title}</h1>
      </div>
      <div className="rf-gallery__stack" data-replay-surface>
        <ReplayFrame chain={chain} expanded={expanded} onExpand={() => setExpanded(true)} onCollapse={collapse} onIntent={log}>
          {view.kind === "tree" ? (
            <TreeRenderer payload={view.tree} gathered={gathered} onIntent={log} />
          ) : sandbox ? (
            <SandboxFrame surface={sandbox} server={server} onIntent={(_id, intent) => log(intent)} onFallback={(reason) => setFallbacks((l) => [...l, reason])} />
          ) : (
            <BlockList payload={payload} gathered={gathered} surfaceKey={surfaceId} onIntent={log} />
          )}
        </ReplayFrame>
      </div>
      <output data-replay-log="intents" hidden>
        {JSON.stringify(intents)}
      </output>
      <output data-replay-log="fallbacks" hidden>
        {JSON.stringify(fallbacks)}
      </output>
    </main>
  );
}

const NO_PREP = () => {};
const NO_RERENDER = () => {};

/** The view frame around the replayed renderer, through its body seam: the stub server and the logged reasons stay the replay's. */
function ReplayFrame({
  chain,
  expanded,
  onExpand,
  onCollapse,
  onIntent,
  children,
}: {
  chain: HostChain;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onIntent: (intent: ActionIntent) => void;
  children: ReactNode;
}) {
  return (
    <ViewFrame
      chain={chain}
      threadId={chain.surface.threadId}
      variant3Enabled={null}
      onIntent={(_id, intent) => onIntent(intent)}
      onPrepSettled={NO_PREP}
      onRerendered={NO_RERENDER}
      expanded={expanded}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      {children}
    </ViewFrame>
  );
}
