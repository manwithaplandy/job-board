"use client";

import { useContext } from "react";
import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV1, V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { CalloutBlock } from "./CalloutBlock";
import { DocumentPreviewBlock } from "./DocumentPreviewBlock";
import { EvidenceMapBlock } from "./EvidenceMapBlock";
import { IntakeQuestionsBlock } from "./IntakeQuestionsBlock";
import { JobCardBlock } from "./JobCardBlock";
import { JobComparisonBlock } from "./JobComparisonBlock";
import { MemoDiffBlock } from "./MemoDiffBlock";
import { MetricChartBlock } from "./MetricChartBlock";
import { PrepChecklistBlock } from "./PrepChecklistBlock";
import { ProfileReadbackBlock } from "./ProfileReadbackBlock";
import { ShortlistQueueBlock } from "./ShortlistQueueBlock";
import { StaleListBlock } from "./StaleListBlock";
import { StatRowBlock } from "./StatRowBlock";
import type { BlockRows, OnIntent } from "./types";
import { ViewHostContext } from "../ViewHostContext";

const NO_ROWS: BlockRows = {};

function Block({
  block,
  gathered,
  rows,
  onIntent,
  onPrepSettled,
}: {
  block: V1Block;
  gathered: GatheredData;
  rows: BlockRows;
  onIntent: OnIntent;
  onPrepSettled?: (jobId: string) => void;
}) {
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
    case "PrepChecklist":
      return <PrepChecklistBlock block={block} gathered={gathered} rows={rows} onIntent={onIntent} onSettled={onPrepSettled} />;
    case "EvidenceMap":
      return <EvidenceMapBlock block={block} gathered={gathered} rows={rows} />;
    case "DocumentPreview":
      return <DocumentPreviewBlock block={block} gathered={gathered} rows={rows} onIntent={onIntent} />;
    case "StatRow":
      return <StatRowBlock block={block} gathered={gathered} />;
    case "MetricChart":
      return <MetricChartBlock block={block} gathered={gathered} onIntent={onIntent} />;
    case "StaleList":
      return <StaleListBlock block={block} gathered={gathered} rows={rows} onIntent={onIntent} />;
  }
}

/**
 * A variant 1 surface (spec 7.1 "Domain blocks"): the agent's ordered blocks, each
 * drawn by a fixed component. `gathered` is the surface's stored gathered data: every
 * score, pay, title, company and posting link is read from it by id. `rows` holds the
 * database rows a block binds to beyond that (memo proposals, application packages, the
 * catalog clock). Buttons emit only
 * closed-enum intents through `onIntent`; the host executes them.
 *
 * Preconditions for the host (Task 1.20): `payload` and `gathered` were total-parsed
 * from the stored row (on failure the host renders the fallback surface instead), and
 * `surfaceKey` is the surface row's id, so a new surface row remounts every block and no
 * local state (sent answers, a compare selection) carries over. `onPrepSettled(jobId)`
 * fires when a prep checklist sees that job's generation settle; reload its package row.
 *
 * Inside a view frame (ViewHostContext) the frame's h3 is the title, so the list draws
 * none of its own; rendered alone it keeps its h2.
 */
export function BlockList({
  payload,
  gathered,
  onIntent,
  surfaceKey,
  rows = NO_ROWS,
  onPrepSettled,
}: {
  payload: SurfacePayloadV1;
  gathered: GatheredData;
  onIntent: OnIntent;
  surfaceKey: string;
  rows?: BlockRows;
  onPrepSettled?: (jobId: string) => void;
}) {
  const inFrame = useContext(ViewHostContext) !== null;
  return (
    <div className="rf-blocks">
      {payload.title && !inFrame && <h2 className="rf-blocks__title">{payload.title}</h2>}
      {payload.blocks.map((block, i) => (
        <Block
          key={`${surfaceKey}:${i}:${block.type}`}
          block={block}
          gathered={gathered}
          rows={rows}
          onIntent={onIntent}
          onPrepSettled={onPrepSettled}
        />
      ))}
    </div>
  );
}
