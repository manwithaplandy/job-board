"use client";

import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV1, V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { CalloutBlock } from "./CalloutBlock";
import { IntakeQuestionsBlock } from "./IntakeQuestionsBlock";
import { JobCardBlock } from "./JobCardBlock";
import { JobComparisonBlock } from "./JobComparisonBlock";
import { MemoDiffBlock } from "./MemoDiffBlock";
import { ProfileReadbackBlock } from "./ProfileReadbackBlock";
import { ShortlistQueueBlock } from "./ShortlistQueueBlock";
import type { BlockRows, OnIntent } from "./types";

const NO_ROWS: BlockRows = {};

function Block({ block, gathered, rows, onIntent }: { block: V1Block; gathered: GatheredData; rows: BlockRows; onIntent: OnIntent }) {
  switch (block.type) {
    case "JobCard":
      return <JobCardBlock block={block} gathered={gathered} onIntent={onIntent} />;
    case "JobComparison":
      return <JobComparisonBlock block={block} gathered={gathered} onIntent={onIntent} />;
    case "ShortlistQueue":
      return <ShortlistQueueBlock block={block} gathered={gathered} onIntent={onIntent} />;
    case "MemoDiff":
      return <MemoDiffBlock block={block} rows={rows} onIntent={onIntent} />;
    case "IntakeQuestions":
      return <IntakeQuestionsBlock block={block} onIntent={onIntent} />;
    case "ProfileReadback":
      return <ProfileReadbackBlock block={block} gathered={gathered} />;
    case "Callout":
      return <CalloutBlock block={block} />;
    default:
      // The prep and metric blocks render from Task 1.19.
      return null;
  }
}

/**
 * A variant 1 surface (spec 7.1 "Domain blocks"): the agent's ordered blocks, each
 * drawn by a fixed component. `gathered` is the surface's stored gathered data: every
 * score, pay, title, company and posting link is read from it by id. `rows` holds the
 * database rows a block binds to beyond that (memo proposals). Buttons emit only
 * closed-enum intents through `onIntent`; the host executes them.
 */
export function BlockList({
  payload,
  gathered,
  onIntent,
  rows = NO_ROWS,
}: {
  payload: SurfacePayloadV1;
  gathered: GatheredData;
  onIntent: OnIntent;
  rows?: BlockRows;
}) {
  return (
    <div className="rf-blocks">
      {payload.title && <h2 className="rf-blocks__title">{payload.title}</h2>}
      {payload.blocks.map((block, i) => (
        <Block key={`${i}-${block.type}`} block={block} gathered={gathered} rows={rows} onIntent={onIntent} />
      ))}
    </div>
  );
}
