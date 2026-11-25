// Reads a finished scenario run back out of the harness database into a Recording
// (plan Task 1.22): the database snapshot the asserts compare against, the tool calls
// from the stored messages, the stored surfaces and the run ledger's usage. Shared by
// the live harness (harness.ts) and the phase 1 gate (phase1.db.test.ts).
//
// The snapshot reads with the owner connection the caller opened through
// lib/testing/dbHarness (which refuses any database but the throwaway harness one);
// messages and surfaces are read through their own stores, as the user, so they are
// parsed exactly as the app parses them.
import { createHash } from "node:crypto";
import { getToolName, isToolUIPart } from "ai";
import { z } from "zod";
import type postgres from "postgres";
import { parseOrNull } from "@/lib/zodParse";
import { loadMessages } from "@/lib/agent/threads";
import { listThreadSurfaces } from "@/lib/agent/surfaces/store";
import type { Variant } from "@/lib/agent/config";
import type { PersonaId } from "@/lib/agent/evals/personas";
import type { ScenarioId } from "@/lib/agent/evals/scenarios";
import {
  RECORDING_FORMAT,
  type ApprovalDecision,
  type DbSnapshot,
  type IntentPress,
  type RecordedToolCall,
  type Recording,
  type ToolCallState,
} from "@/lib/agent/evals/recording";

const num = z.coerce.number();
const nullableNum = z.union([z.null(), z.coerce.number()]);

function rowsOrThrow<T>(schema: z.ZodType<T>, rows: unknown, what: string): T[] {
  const parsed = parseOrNull(z.array(schema), rows);
  if (!parsed) throw new Error(`eval snapshot: ${what} rows failed the parse`);
  return parsed;
}

/** The database as the asserts see it, for one user (owner connection, so no RLS). */
export async function snapshotDb(sql: postgres.Sql, userId: string): Promise<DbSnapshot> {
  const jobs = rowsOrThrow(
    z.object({ id: z.string(), title: z.string(), url: z.string(), company: z.string() }),
    await sql`
      SELECT j.id, j.title, j.url, COALESCE(c.display_name, c.name) AS company
      FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id IN (SELECT job_id FROM job_reviews WHERE user_id = ${userId}::uuid
                     UNION SELECT job_id FROM shortlist_items WHERE user_id = ${userId}::uuid
                     UNION SELECT job_id FROM applications WHERE user_id = ${userId}::uuid)
      ORDER BY j.id`,
    "jobs",
  );
  const reviews = rowsOrThrow(
    z.object({
      job_id: z.string(),
      fit_score: nullableNum,
      pay_min: nullableNum,
      pay_max: nullableNum,
      pay_currency: z.string().nullable(),
      pay_period: z.string().nullable(),
    }),
    await sql`
      SELECT r.job_id,
             COALESCE(rc.fit_score, r.fit_score) AS fit_score,
             COALESCE(rc.pay_min, r.pay_min) AS pay_min,
             COALESCE(rc.pay_max, r.pay_max) AS pay_max,
             COALESCE(rc.pay_currency, r.pay_currency) AS pay_currency,
             COALESCE(rc.pay_period, r.pay_period) AS pay_period
      FROM job_reviews r
      LEFT JOIN review_corrections rc ON rc.job_id = r.job_id AND rc.user_id = r.user_id
      WHERE r.user_id = ${userId}::uuid AND r.error IS NULL
      ORDER BY r.job_id`,
    "reviews",
  );
  const shortlist = rowsOrThrow(
    z.object({ job_id: z.string(), state: z.string(), set_by: z.string() }),
    await sql`SELECT job_id, state, set_by FROM shortlist_items WHERE user_id = ${userId}::uuid ORDER BY job_id`,
    "shortlist",
  );
  const memo = rowsOrThrow(
    z.object({ version: num }),
    await sql`SELECT version FROM search_memos WHERE user_id = ${userId}::uuid`,
    "memo",
  );
  const memoVersions = rowsOrThrow(
    z.object({ version: num, changed_by: z.string(), proposal_id: z.string().nullable() }),
    await sql`SELECT version, changed_by, proposal_id FROM search_memo_versions WHERE user_id = ${userId}::uuid ORDER BY version`,
    "memo versions",
  );
  const memoProposals = rowsOrThrow(
    z.object({ id: z.string(), status: z.string() }),
    await sql`SELECT id, status FROM search_memo_proposals WHERE user_id = ${userId}::uuid ORDER BY created_at, id`,
    "memo proposals",
  );
  const packages = rowsOrThrow(
    z.object({ job_id: z.string(), status: z.string(), resume_json: z.unknown() }),
    await sql`SELECT job_id, status, resume_json FROM application_packages WHERE user_id = ${userId}::uuid ORDER BY job_id`,
    "packages",
  );
  const profile = rowsOrThrow(
    z.object({ resume_text: z.string().nullable() }),
    await sql`SELECT resume_text FROM profiles WHERE user_id = ${userId}::uuid`,
    "profile",
  );
  const applications = rowsOrThrow(
    z.object({ job_id: z.string(), stage: z.string() }),
    await sql`SELECT job_id, stage FROM applications WHERE user_id = ${userId}::uuid ORDER BY job_id`,
    "applications",
  );
  return {
    jobs: jobs.map((j) => ({ jobId: j.id, title: j.title, company: j.company, url: j.url })),
    reviews: reviews.map((r) => ({
      jobId: r.job_id,
      fitScore: r.fit_score,
      payMin: r.pay_min,
      payMax: r.pay_max,
      payCurrency: r.pay_currency,
      payPeriod: r.pay_period,
    })),
    shortlist: shortlist.map((s) => ({ jobId: s.job_id, state: s.state, setBy: s.set_by })),
    memoVersion: memo[0]?.version ?? null,
    memoVersions: memoVersions.map((v) => ({ version: v.version, changedBy: v.changed_by, proposalId: v.proposal_id })),
    memoProposals,
    packages: packages.map((p) => ({ jobId: p.job_id, status: p.status, resume: p.resume_json ?? null })),
    resumeText: profile[0]?.resume_text ?? null,
    applications: applications.map((a) => ({ jobId: a.job_id, stage: a.stage })),
  };
}

const STATE_OF: Record<string, ToolCallState> = {
  "input-streaming": "incomplete",
  "input-available": "incomplete",
  "approval-requested": "pending",
  "approval-responded": "pending",
  "output-available": "executed",
  "output-error": "error",
  "output-denied": "denied",
};

const approvalSchema = z.object({ id: z.string(), approved: z.boolean().optional() });

/** Every tool call in the thread's stored messages, in order. */
export async function threadToolCalls(userId: string, threadId: string): Promise<RecordedToolCall[]> {
  const out: RecordedToolCall[] = [];
  for (const m of await loadMessages(userId, threadId)) {
    if (m.role !== "assistant") continue;
    for (const part of m.parts) {
      if (!isToolUIPart(part)) continue;
      const approval = "approval" in part ? parseOrNull(approvalSchema, part.approval) : null;
      const output = part.state === "output-available" ? JSON.stringify(part.output ?? null) : null;
      out.push({
        toolCallId: part.toolCallId,
        name: getToolName(part),
        input: part.input ?? null,
        state: STATE_OF[part.state] ?? "incomplete",
        approval: approval ? { id: approval.id, approved: approval.approved ?? null } : null,
        outputDigest: output === null ? null : createHash("sha256").update(output, "utf8").digest("hex"),
      });
    }
  }
  return out;
}

/** The thread's billed usage from the run ledger (every turn of the scenario). */
export async function threadUsage(sql: postgres.Sql, threadId: string): Promise<Recording["usage"]> {
  const [row] = rowsOrThrow(
    z.object({ cost: num, input: num, output: num }),
    await sql`
      SELECT COALESCE(sum(cost_micros), 0) AS cost, COALESCE(sum(input_tokens), 0) AS input,
             COALESCE(sum(output_tokens), 0) AS output
      FROM agent_runs WHERE thread_id = ${threadId}::uuid`,
    "usage",
  );
  return { costMicros: row?.cost ?? 0, inputTokens: row?.input ?? 0, outputTokens: row?.output ?? 0 };
}

export interface CollectArgs {
  sql: postgres.Sql;
  source: Recording["source"];
  scenario: ScenarioId;
  persona: PersonaId;
  userId: string;
  threadId: string;
  variant: Variant;
  model: string;
  seed: number;
  approvals: ApprovalDecision[];
  intents: IntentPress[];
  dbBefore: DbSnapshot;
  timings: Recording["timings"];
}

/** The finished run as a Recording: snapshot after, tool calls, surfaces and usage. */
export async function collectRecording(a: CollectArgs): Promise<Recording> {
  return {
    format: RECORDING_FORMAT,
    source: a.source,
    scenario: a.scenario,
    persona: a.persona,
    variant: a.variant,
    model: a.model,
    seed: a.seed,
    toolCalls: await threadToolCalls(a.userId, a.threadId),
    approvals: a.approvals,
    intents: a.intents,
    surfaces: await listThreadSurfaces(a.userId, a.threadId),
    dbBefore: a.dbBefore,
    dbAfter: await snapshotDb(a.sql, a.userId),
    usage: await threadUsage(a.sql, a.threadId),
    timings: a.timings,
  };
}
