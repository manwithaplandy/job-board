"use client";

// The client half of the replay page (plan Task 2.11): one surface through the renderer the
// host would pick (BlockList, TreeRenderer or SandboxFrame), with presses and fallbacks
// written to <output data-replay-log="..."> for the render smoke to read. Nothing a press
// asks for runs: intents are only logged, and the frame's stub describes no chip.
import { useMemo, useState } from "react";
import { BlockList } from "@/components/agent/blocks/BlockList";
import { TreeRenderer } from "@/components/agent/tree/TreeRenderer";
import { SandboxFrame, type SandboxFrameServer } from "@/components/agent/sandbox/SandboxFrame";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfaceView } from "@/lib/agent/surfaces/host";
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
  const log = (intent: ActionIntent) => setIntents((l) => [...l, intent]);
  const server = useMemo<SandboxFrameServer>(
    () => ({
      describe: async () => null,
      report: async () => null,
    }),
    [],
  );

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
        {view.kind === "tree" ? (
          <TreeRenderer payload={view.tree} gathered={gathered} onIntent={log} />
        ) : view.kind === "sandbox" ? (
          <SandboxFrame
            surface={{ id: surfaceId, threadId, payload: view.document, gathered, fallback: payload, rows: {} }}
            server={server}
            onIntent={(_id, intent) => log(intent)}
            onFallback={(reason) => setFallbacks((l) => [...l, reason])}
          />
        ) : (
          <BlockList payload={payload} gathered={gathered} surfaceKey={surfaceId} onIntent={log} />
        )}
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
