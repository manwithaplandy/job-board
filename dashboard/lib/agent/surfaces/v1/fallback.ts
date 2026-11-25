// The deterministic fallback surface (plan Task 1.17, decision D8): what the user sees
// when a payload fails its variant's gate. Built only from what the turn's tools read
// (ctx.gathered) plus optional plain text, so it always passes validateSurface: a
// Callout with the text, one JobCard per gathered job (at most 5), then a StatRow when
// metrics were read. With nothing gathered and no text it is a single fixed Callout.
import type { GatheredData } from "@/lib/agent/gathered";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import type { SurfacePayloadV1, V1Block } from "@/lib/agent/surfaces/v1/blocks";

const FALLBACK_JOBS_MAX = 5;
const STAT_REFS_MAX = 4;
const CALLOUT_TEXT_MAX = 400;
export const FALLBACK_EMPTY_TEXT = "I couldn't lay this out as planned. Ask me again, or tell me what you'd like to see.";

/** The first `max` code points of `text`, so a surrogate pair is never split. */
function clamp(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("");
}

export function fallbackSurface(gathered: GatheredData, text?: string): SurfacePayloadV1 {
  const blocks: V1Block[] = [];
  const t = typeof text === "string" ? clamp(text.trim(), CALLOUT_TEXT_MAX).trim() : "";
  if (t !== "") blocks.push({ type: "Callout", tone: "info", text: t });
  // Same id rule as the JobCard schema, so a malformed key can never break the fallback.
  const jobIds = Object.keys(gathered.jobs).filter((id) => id.length <= 300 && JOB_ID_RE.test(id));
  for (const jobId of jobIds.slice(0, FALLBACK_JOBS_MAX)) blocks.push({ type: "JobCard", jobId });
  const refs = Math.min(gathered.metrics.length, STAT_REFS_MAX);
  if (refs > 0) blocks.push({ type: "StatRow", metricRefs: Array.from({ length: refs }, (_, i) => i) });
  if (blocks.length === 0) blocks.push({ type: "Callout", tone: "info", text: FALLBACK_EMPTY_TEXT });
  return { variant: 1, blocks };
}
