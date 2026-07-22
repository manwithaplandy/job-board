// Wire/DB codec for classification_jobs rows (admin-launched global company
// classification queue).
//
// Pure module — importable from BOTH the server data layer (lib/classificationJobs.ts)
// and the client poller (components/admin/ClassificationJobsPanel.tsx), so "valid
// classification job" has one definition and serialize/deserialize can't drift. It
// pulls in NO server-only deps (no serviceSql/@/lib/db, no Node builtins), so the
// admin panel can total-parse the poll response client-side without dragging the
// service-role pool into the browser bundle. Mirrors generationJobCodec.ts.
//
// House boundary rule (dashboard/CLAUDE.md): the total parser accepts a snake_case DB
// row (SELECT *) OR the camel-case JSON that shape serializes to, so the admin poll
// route round-trips through the SAME parser. NUMERIC/BIGINT columns arrive from
// postgres.js as strings and are normalized to number|null via Number() at this read
// boundary — never `as`-cast.

export type ClassificationJobStatus =
  | "pending"
  | "running"
  | "done"
  | "canceled"
  | "error";
export type ClassificationSelectionMode = "unclassified" | "unknown_repass";

const STATUSES: readonly ClassificationJobStatus[] = [
  "pending",
  "running",
  "done",
  "canceled",
  "error",
];
const MODES: readonly ClassificationSelectionMode[] = ["unclassified", "unknown_repass"];

/** One classification_jobs row, every column typed (camel-case view). */
export interface ClassificationJobRow {
  id: number;
  status: ClassificationJobStatus;
  model: string;
  companyCap: number;
  selectionMode: ClassificationSelectionMode;
  useSerp: boolean;
  estCost: number | null;
  processed: number;
  errored: number;
  serpQueries: number;
  actualPromptTokens: number;
  actualCompletionTokens: number;
  actualCost: number | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const parseStatus = (v: unknown): ClassificationJobStatus | null =>
  STATUSES.includes(v as ClassificationJobStatus) ? (v as ClassificationJobStatus) : null;

const parseMode = (v: unknown): ClassificationSelectionMode | null =>
  MODES.includes(v as ClassificationSelectionMode) ? (v as ClassificationSelectionMode) : null;

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

// INT arrives as a JS number; BIGINT/NUMERIC arrive as a string from postgres.js and
// as a number over the JSON wire. Returns null for anything non-finite (so a required
// field's absence drops the whole row; a nullable field just stays null).
const asNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const asBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

// timestamptz is a Date from postgres.js and an ISO string over the wire.
const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" && v !== "" ? v : null;

/** Total parse of one classification_jobs row. Returns null on a malformed row. */
export function parseClassificationJob(raw: unknown): ClassificationJobRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = asNum(r.id);
  const status = parseStatus(r.status);
  const model = str(r.model);
  const companyCap = asNum(r.companyCap ?? r.company_cap);
  const selectionMode = parseMode(r.selectionMode ?? r.selection_mode);
  const useSerp = asBool(r.useSerp ?? r.use_serp);
  const processed = asNum(r.processed);
  const errored = asNum(r.errored);
  const serpQueries = asNum(r.serpQueries ?? r.serp_queries);
  const actualPromptTokens = asNum(r.actualPromptTokens ?? r.actual_prompt_tokens);
  const actualCompletionTokens = asNum(r.actualCompletionTokens ?? r.actual_completion_tokens);
  const createdAt = iso(r.createdAt ?? r.created_at);
  if (
    id === null ||
    status === null ||
    model === null ||
    companyCap === null ||
    selectionMode === null ||
    useSerp === null ||
    processed === null ||
    errored === null ||
    serpQueries === null ||
    actualPromptTokens === null ||
    actualCompletionTokens === null ||
    createdAt === null
  ) {
    return null;
  }
  return {
    id,
    status,
    model,
    companyCap,
    selectionMode,
    useSerp,
    estCost: asNum(r.estCost ?? r.est_cost),
    processed,
    errored,
    serpQueries,
    actualPromptTokens,
    actualCompletionTokens,
    actualCost: asNum(r.actualCost ?? r.actual_cost),
    error: str(r.error),
    createdAt,
    startedAt: iso(r.startedAt ?? r.started_at),
    finishedAt: iso(r.finishedAt ?? r.finished_at),
  };
}
