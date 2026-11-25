// The deterministic asserts over a golden-scenario recording (plan Task 1.22, spec 11
// layer 3). Each returns failures, never throws, so one run reports everything wrong
// with it at once:
//
//   - what a surface shows equals the database: every title, company, fit score and pay
//     a surface binds to (its gathered data) is the stored value, and every posting link
//     is the stored URL; no other link appears anywhere in a payload;
//   - every action a surface offers or the user pressed is an intent with a handler;
//   - no confirmation tool ran without the user's approval;
//   - the memo changed only through a proposal the user approved on a surface;
//   - a tailored résumé the run produced passes resumeChecks against the profile;
//   - scenario (a) ends with rows on the shortlist; scenario (d) shows metrics, and every
//     rate it shows carries its n (and is null below the minimum n).
//
// Pure: no database import. The database values come from the recording's snapshots.
import { V1_BLOCK_TYPES, SurfacePayloadV1Schema, type V1Block, type V1BlockType } from "@/lib/agent/surfaces/v1/blocks";
import { parseGathered } from "@/lib/agent/gatheredSchema";
import type { GatheredData } from "@/lib/agent/gathered";
import { ActionIntentSchema, INTENT_NAMES, type IntentName } from "@/lib/agent/actions/intents";
import type { ApprovalToolName } from "@/lib/agent/tools/approval";
import { parseTailoredResume } from "@/lib/rolefit/packageCodec";
import { parseProfileText } from "@/lib/rolefit/parseProfile";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";
import { RATE_METRICS, RESPONSE_RATE_MIN_N } from "@/lib/workspaces/metrics/catalog";
import type { MetricResult } from "@/lib/workspaces/types";
import type { DbSnapshot, Recording } from "@/lib/agent/evals/recording";

export type AssertCode =
  | "gathered_invalid"
  | "surface_invalid"
  | "job_not_in_database"
  | "job_not_gathered"
  | "title_mismatch"
  | "company_mismatch"
  | "fit_mismatch"
  | "pay_mismatch"
  | "link_mismatch"
  | "link_in_text"
  | "unknown_block"
  | "unhandled_action"
  | "unapproved_tool"
  | "memo_changed_without_proposal"
  | "resume_checks_failed"
  | "scenario_a_no_shortlist"
  | "scenario_d_no_metrics"
  | "metric_not_gathered"
  | "rate_without_n"
  | "rate_below_min_n";

export interface AssertFailure {
  code: AssertCode;
  message: string;
  /** Where in the recording, e.g. surfaces[2].payload.blocks[0]. */
  path?: string;
}

/**
 * The tools that need the user's approval (TOOL_APPROVAL in lib/agent/tools/approval.ts,
 * which imports the database, so it is restated here). The two type checks below fail
 * the build if the lists ever differ in either direction.
 */
export const CONFIRMATION_TOOLS = [
  "start_application_prep",
  "set_resume",
  "refine_documents",
  "propose_profile_details",
] as const satisfies readonly ApprovalToolName[];
type MissingConfirmationTool = Exclude<ApprovalToolName, (typeof CONFIRMATION_TOOLS)[number]>;
const confirmationToolsComplete: [MissingConfirmationTool] extends [never] ? true : false = true;
void confirmationToolsComplete;

/**
 * The intents each variant 1 block's controls send (components/agent/blocks/*). A block
 * carries ids only; the host draws its buttons, so this table is the surface's set of
 * actions. asserts.test.ts pins it to the 13 block types.
 */
export const BLOCK_INTENTS: Record<V1BlockType, readonly IntentName[]> = {
  JobCard: ["shortlist.set", "application.prepare"],
  JobComparison: ["shortlist.set", "application.prepare"],
  ShortlistQueue: ["shortlist.set", "application.prepare", "compare"],
  MemoDiff: ["memo.review", "memo.resolve"],
  PrepChecklist: ["application.prepare", "open"],
  EvidenceMap: [],
  DocumentPreview: ["application.set_stage"],
  StatRow: [],
  MetricChart: ["analytics.pin"],
  IntakeQuestions: ["answer"],
  ProfileReadback: [],
  StaleList: ["application.set_stage", "open"],
  Callout: [],
};

/** The tool readers' caps (lib/agent/tools/read.ts TEXT_CAPS): gathered text is the stored text cut to these. */
const TITLE_CAP = 200;
const COMPANY_CAP = 120;
const URL_RE = /https?:\/\/[^\s"'<>()]+/g;

const intentNames: ReadonlySet<string> = new Set(INTENT_NAMES);
const blockTypes: ReadonlySet<string> = new Set(V1_BLOCK_TYPES);

function cap(text: string, max: number): string {
  return text.length <= max ? text : Array.from(text).slice(0, max).join("");
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Every string inside a JSON value, with its path. */
function* strings(v: unknown, path: string): Generator<[string, string]> {
  if (typeof v === "string") yield [v, path];
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* strings(x, `${path}[${i}]`);
  else if (isObject(v)) for (const [k, x] of Object.entries(v)) yield* strings(x, `${path}.${k}`);
}

/** Every object under an `action` or `intent` key that names an intent (variant 2 buttons, variant 3 messages). */
function* namedActions(v: unknown, path: string): Generator<[Record<string, unknown>, string]> {
  if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) yield* namedActions(x, `${path}[${i}]`);
  } else if (isObject(v)) {
    for (const [k, x] of Object.entries(v)) {
      if ((k === "action" || k === "intent") && isObject(x) && typeof x.name === "string") yield [x, `${path}.${k}`];
      yield* namedActions(x, `${path}.${k}`);
    }
  }
}

function blockJobIds(b: V1Block): string[] {
  switch (b.type) {
    case "JobCard":
    case "PrepChecklist":
    case "EvidenceMap":
    case "DocumentPreview":
      return [b.jobId];
    case "JobComparison":
      return [...b.jobIds];
    case "ShortlistQueue":
      return b.jobIds;
    default:
      return [];
  }
}

function blockMetricRefs(b: V1Block): number[] {
  if (b.type === "StatRow") return b.metricRefs;
  if (b.type === "MetricChart") return [b.metricRef];
  return [];
}

interface Db {
  jobs: Map<string, DbSnapshot["jobs"][number]>;
  reviews: Map<string, DbSnapshot["reviews"][number]>;
  urls: Set<string>;
}

function dbIndex(r: Recording): Db {
  const urls = new Set<string>();
  for (const j of [...r.dbBefore.jobs, ...r.dbAfter.jobs]) urls.add(j.url);
  return {
    jobs: new Map(r.dbAfter.jobs.map((j) => [j.jobId, j])),
    reviews: new Map(r.dbAfter.reviews.map((v) => [v.jobId, v])),
    urls,
  };
}

/** The gathered values a surface binds to, against the database. */
function checkGathered(g: GatheredData, db: Db, path: string, out: AssertFailure[]): void {
  const checkJob = (job: GatheredData["jobs"][string], at: string) => {
    const row = db.jobs.get(job.jobId);
    if (!row) {
      out.push({ code: "job_not_in_database", message: `${job.jobId} is not a stored job`, path: at });
      return;
    }
    if (job.title !== cap(row.title, TITLE_CAP)) {
      out.push({ code: "title_mismatch", message: `${job.jobId}: shown "${job.title}", stored "${row.title}"`, path: at });
    }
    if (job.company !== cap(row.company, COMPANY_CAP)) {
      out.push({ code: "company_mismatch", message: `${job.jobId}: shown "${job.company}", stored "${row.company}"`, path: at });
    }
    if (job.url !== row.url) {
      out.push({ code: "link_mismatch", message: `${job.jobId}: link is not the stored URL`, path: at });
    }
  };
  const checkFit = (jobId: string, fit: number | null, at: string) => {
    const row = db.reviews.get(jobId);
    if (!row || row.fitScore !== fit) {
      out.push({ code: "fit_mismatch", message: `${jobId}: shown fit ${fit}, stored ${row ? row.fitScore : "no review"}`, path: at });
    }
  };

  for (const [key, job] of Object.entries(g.jobs)) checkJob(job, `${path}.jobs[${key}]`);
  for (const [key, review] of Object.entries(g.reviews)) {
    const at = `${path}.reviews[${key}]`;
    checkFit(review.jobId, review.fitScore, at);
    const row = db.reviews.get(review.jobId);
    if (
      row &&
      (row.payMin !== review.payMin ||
        row.payMax !== review.payMax ||
        row.payCurrency !== review.payCurrency ||
        row.payPeriod !== review.payPeriod)
    ) {
      out.push({ code: "pay_mismatch", message: `${review.jobId}: shown pay differs from the stored review`, path: at });
    }
  }
  for (const [i, row] of g.shortlist.entries()) {
    checkJob(row.job, `${path}.shortlist[${i}].job`);
    checkFit(row.jobId, row.fitScore, `${path}.shortlist[${i}]`);
  }
  for (const [i, row] of g.applications.entries()) checkJob(row.job, `${path}.applications[${i}].job`);
}

/** A variant 1 payload: its blocks, their actions and the jobs and metrics they reference. */
function checkV1Payload(
  raw: Record<string, unknown>,
  g: GatheredData | null,
  db: Db,
  path: string,
  out: AssertFailure[],
  shownMetrics: MetricResult[],
): void {
  const parsed = SurfacePayloadV1Schema.safeParse(raw);
  if (!parsed.success) {
    const types = Array.isArray(raw.blocks) ? raw.blocks.map((b) => (isObject(b) ? b.type : undefined)) : [];
    for (const [i, t] of types.entries()) {
      if (typeof t !== "string" || !blockTypes.has(t)) {
        out.push({ code: "unknown_block", message: `block type ${String(t)} has no renderer or handlers`, path: `${path}.blocks[${i}]` });
      }
    }
    out.push({ code: "surface_invalid", message: "the payload fails the variant 1 grammar", path });
    return;
  }
  for (const [i, block] of parsed.data.blocks.entries()) {
    const at = `${path}.blocks[${i}]`;
    for (const name of BLOCK_INTENTS[block.type] ?? []) {
      if (!intentNames.has(name)) out.push({ code: "unhandled_action", message: `${block.type} offers ${name}, which has no handler`, path: at });
    }
    for (const jobId of blockJobIds(block)) {
      if (!db.jobs.has(jobId)) out.push({ code: "job_not_in_database", message: `${block.type} shows ${jobId}, which is not stored`, path: at });
      else if (g && !g.jobs[jobId]) out.push({ code: "job_not_gathered", message: `${block.type} shows ${jobId}, which this turn did not read`, path: at });
    }
    if (g) {
      for (const ref of blockMetricRefs(block)) {
        const m = g.metrics[ref];
        if (m) shownMetrics.push(m);
        else out.push({ code: "metric_not_gathered", message: `${block.type} refers to metric ${ref}, which was not read`, path: at });
      }
    }
  }
}

function checkSurfaces(r: Recording, db: Db, out: AssertFailure[]): MetricResult[] {
  const shownMetrics: MetricResult[] = [];
  for (const [i, s] of r.surfaces.entries()) {
    const path = `surfaces[${i}]`;
    const g = parseGathered(s.gathered);
    if (!g) out.push({ code: "gathered_invalid", message: "the stored gathered data does not parse", path: `${path}.gathered` });
    else checkGathered(g, db, `${path}.gathered`, out);

    const payloads: Array<[string, Record<string, unknown>]> = [[`${path}.payload`, s.payload]];
    if (s.fallbackPayload) payloads.push([`${path}.fallbackPayload`, s.fallbackPayload]);
    for (const [at, payload] of payloads) {
      for (const [text, where] of strings(payload, at)) {
        for (const url of text.match(URL_RE) ?? []) {
          if (!db.urls.has(url)) out.push({ code: "link_in_text", message: `a link that is not a stored posting URL: ${url}`, path: where });
        }
      }
      for (const [action, where] of namedActions(payload, at)) {
        if (!intentNames.has(String(action.name))) {
          out.push({ code: "unhandled_action", message: `action ${String(action.name)} has no handler`, path: where });
        }
      }
      // Only the payload counts as shown for scenario (d); the fallback is shown only if it fails to render.
      const metrics = at.endsWith(".payload") ? shownMetrics : [];
      if (s.variant === 1) checkV1Payload(payload, g, db, at, out, metrics);
    }
  }
  return shownMetrics;
}

function checkIntents(r: Recording, out: AssertFailure[]): void {
  for (const [i, press] of r.intents.entries()) {
    const name = isObject(press.intent) ? press.intent.name : undefined;
    if (typeof name !== "string" || !intentNames.has(name) || !ActionIntentSchema.safeParse(press.intent).success) {
      out.push({ code: "unhandled_action", message: `pressed action ${String(name)} has no handler`, path: `intents[${i}]` });
    }
  }
}

function checkApprovals(r: Recording, out: AssertFailure[]): void {
  const confirmation: ReadonlySet<string> = new Set(CONFIRMATION_TOOLS);
  for (const [i, call] of r.toolCalls.entries()) {
    if (!confirmation.has(call.name) || (call.state !== "executed" && call.state !== "error")) continue;
    const approval = call.approval;
    const sent = approval !== null && r.approvals.some((a) => a.approvalId === approval.id && a.approved);
    if (!approval || approval.approved !== true || !sent) {
      out.push({ code: "unapproved_tool", message: `${call.name} ran without the user's approval`, path: `toolCalls[${i}]` });
    }
  }
}

function checkMemo(r: Recording, out: AssertFailure[]): void {
  const before = new Set(r.dbBefore.memoVersions.map((v) => v.version));
  const created = r.dbAfter.memoVersions.filter((v) => !before.has(v.version));
  for (const v of created) {
    const proposal = v.proposalId === null ? undefined : r.dbAfter.memoProposals.find((p) => p.id === v.proposalId);
    const pressed = r.intents.some(
      (press) =>
        isObject(press.intent) &&
        press.intent.name === "memo.resolve" &&
        press.intent.decision === "approve" &&
        press.intent.proposalId === v.proposalId,
    );
    if (v.changedBy !== "proposal" || !proposal || proposal.status !== "approved" || !pressed) {
      out.push({
        code: "memo_changed_without_proposal",
        message: `memo version ${v.version} was written by ${v.changedBy}, not by a proposal the user approved`,
        path: "dbAfter.memoVersions",
      });
    }
  }
  if (r.dbAfter.memoVersion !== r.dbBefore.memoVersion && !created.some((v) => v.version === r.dbAfter.memoVersion)) {
    out.push({
      code: "memo_changed_without_proposal",
      message: `the memo moved from version ${r.dbBefore.memoVersion} to ${r.dbAfter.memoVersion} with no version row`,
      path: "dbAfter.memoVersion",
    });
  }
}

function checkResumes(r: Recording, out: AssertFailure[]): void {
  const parsedProfile = r.dbAfter.resumeText === null ? undefined : parseProfileText(r.dbAfter.resumeText);
  for (const [i, pkg] of r.dbAfter.packages.entries()) {
    if (pkg.resume === null || pkg.resume === undefined) continue;
    const before = r.dbBefore.packages.find((p) => p.jobId === pkg.jobId);
    if (before && JSON.stringify(before.resume) === JSON.stringify(pkg.resume)) continue;
    const at = `dbAfter.packages[${i}]`;
    const resume = parseTailoredResume(pkg.resume);
    if (!resume) {
      out.push({ code: "resume_checks_failed", message: `${pkg.jobId}: the stored résumé is not a tailored résumé`, path: at });
      continue;
    }
    const failed = resumeChecks(resume, parsedProfile).checks.filter((c) => !c.pass);
    if (failed.length > 0) {
      out.push({
        code: "resume_checks_failed",
        message: `${pkg.jobId}: ${failed.map((c) => (c.detail ? `${c.id} (${c.detail})` : c.id)).join(", ")}`,
        path: at,
      });
    }
  }
}

function checkScenario(r: Recording, shownMetrics: MetricResult[], out: AssertFailure[]): void {
  if (r.scenario === "a_resume_upload" && r.dbAfter.shortlist.length === 0) {
    out.push({ code: "scenario_a_no_shortlist", message: "scenario (a) ended with nothing on the shortlist", path: "dbAfter.shortlist" });
  }
  if (r.scenario !== "d_weekly") return;
  if (shownMetrics.length === 0) {
    out.push({ code: "scenario_d_no_metrics", message: "scenario (d) showed no metric", path: "surfaces" });
  }
  for (const m of shownMetrics) {
    if (!RATE_METRICS.has(m.spec.metric)) continue;
    if (!Number.isInteger(m.n) || m.n < 0) {
      out.push({ code: "rate_without_n", message: `${m.spec.metric} is shown without its n`, path: "surfaces" });
    } else if (m.kind === "value" && m.value !== null && m.n < RESPONSE_RATE_MIN_N) {
      out.push({ code: "rate_below_min_n", message: `${m.spec.metric} is shown from n = ${m.n}`, path: "surfaces" });
    }
  }
}

/** Every deterministic failure in one recording; [] when it passes. */
export function assertRecording(r: Recording): AssertFailure[] {
  const out: AssertFailure[] = [];
  const db = dbIndex(r);
  const shownMetrics = checkSurfaces(r, db, out);
  checkIntents(r, out);
  checkApprovals(r, out);
  checkMemo(r, out);
  checkResumes(r, out);
  checkScenario(r, shownMetrics, out);
  return out;
}
