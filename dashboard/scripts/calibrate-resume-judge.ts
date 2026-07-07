// Résumé judge calibration + golden-dataset backfill.
//   node --experimental-strip-types --env-file-if-exists=.env.local scripts/calibrate-resume-judge.ts          → calibration report
//   node --experimental-strip-types --env-file-if-exists=.env.local scripts/calibrate-resume-judge.ts --sync   → re-push resume_scores → resume-golden
// Requires LANGFUSE_* (+ DATABASE_URL) in the environment (.env.local).
import { LangfuseClient } from "@langfuse/client";
import { resolveLangfuseHost } from "../lib/langfuseHost.ts";
import { serviceSql } from "../lib/db.ts";
import { buildResumeGoldenItem } from "../lib/rolefit/resumeScore.ts";
import { upsertResumeGoldenItem } from "../lib/resumeGoldenDataset.ts";
import {
  RESUME_JUDGE_GROUNDING_SCORE_NAME,
  RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME,
} from "../lib/rolefit/resumeJudgeRubric.ts";

interface ScoreRow {
  user_id: string; job_id: string; grounding: number; jd_relevance: number;
  comment: string | null; resume_trace_id: string | null; model: string | null; scored_at: string;
  title: string; company_name: string; description: string | null; resume_text: string | null;
}

async function loadScores(): Promise<ScoreRow[]> {
  return (await serviceSql`
    SELECT s.user_id, s.job_id, s.grounding, s.jd_relevance, s.comment,
           s.resume_trace_id, s.model, s.scored_at::text AS scored_at,
           j.title, c.name AS company_name, j.description, p.resume_text
    FROM resume_scores s
    JOIN jobs j       ON j.id = s.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN profiles p ON p.user_id = s.user_id
    ORDER BY s.scored_at DESC
  `) as unknown as ScoreRow[];
}

async function sync(): Promise<void> {
  const rows = await loadScores();
  let n = 0;
  for (const r of rows) {
    await upsertResumeGoldenItem(
      buildResumeGoldenItem({
        userId: r.user_id, jobId: r.job_id,
        input: { title: r.title, company: r.company_name, description: r.description, background: r.resume_text, model: r.model },
        form: { grounding: r.grounding, jdRelevance: r.jd_relevance, comment: r.comment },
        traceId: r.resume_trace_id, model: r.model, scoredAt: r.scored_at,
      }),
    );
    n++;
  }
  console.log(`synced ${n} resume_scores → resume-golden`);
}

function client(): LangfuseClient {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    throw new Error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY required");
  }
  return new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: resolveLangfuseHost(),
  });
}

// Read the managed judge's scores off a trace. `api.trace.get` returns the trace
// with its `scores` array; each score has a `name` + numeric `value`. If the SDK
// shape differs, adjust the accessor — the concept (name→value on the trace) holds.
// verify SDK shape
async function judgeScores(c: LangfuseClient, traceId: string): Promise<{ grounding?: number; jd?: number }> {
  const trace = (await c.api.trace.get(traceId)) as unknown as {
    scores?: { name: string; value: number }[];
  };
  const byName = (name: string) => trace.scores?.find((s) => s.name === name)?.value;
  return {
    grounding: byName(RESUME_JUDGE_GROUNDING_SCORE_NAME),
    jd: byName(RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME),
  };
}

async function calibrate(): Promise<void> {
  const rows = (await loadScores()).filter((r) => r.resume_trace_id);
  if (rows.length === 0) { console.log("no scored résumés with a trace id yet"); return; }
  const c = client();

  const agg = {
    grounding: { n: 0, exact: 0, absErr: 0 },
    jd: { n: 0, exact: 0, absErr: 0 },
  };
  const disagreements: string[] = [];

  for (const r of rows) {
    const j = await judgeScores(c, r.resume_trace_id as string);
    if (typeof j.grounding === "number") {
      agg.grounding.n++;
      if (j.grounding === r.grounding) agg.grounding.exact++;
      const d = Math.abs(j.grounding - r.grounding);
      agg.grounding.absErr += d;
      if (d >= 2) disagreements.push(`${r.user_id}:${r.job_id} grounding human=${r.grounding} judge=${j.grounding}`);
    }
    if (typeof j.jd === "number") {
      agg.jd.n++;
      if (j.jd === r.jd_relevance) agg.jd.exact++;
      const d = Math.abs(j.jd - r.jd_relevance);
      agg.jd.absErr += d;
      if (d >= 2) disagreements.push(`${r.user_id}:${r.job_id} jd human=${r.jd_relevance} judge=${j.jd}`);
    }
  }

  const report = (name: string, a: { n: number; exact: number; absErr: number }) =>
    a.n === 0
      ? `${name}: no judge scores found`
      : `${name}: n=${a.n} exact-agree=${((a.exact / a.n) * 100).toFixed(0)}% MAE=${(a.absErr / a.n).toFixed(2)}`;

  console.log("=== résumé judge calibration (human vs Claude Sonnet 5) ===");
  console.log(report("grounding   ", agg.grounding));
  console.log(report("jd_relevance", agg.jd));
  if (disagreements.length) {
    console.log(`\nlargest disagreements (|Δ|≥2):`);
    disagreements.forEach((d) => console.log("  " + d));
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--sync")) await sync();
  else await calibrate();
  await serviceSql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
