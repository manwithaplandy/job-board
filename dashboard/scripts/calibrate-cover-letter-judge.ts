// Cover-letter judge: golden-dataset backfill + offline replay-and-judge report.
//
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings \
//     --import ./scripts/alias-loader.mjs scripts/calibrate-cover-letter-judge.ts --sync
//   node --env-file-if-exists=.env.local --experimental-strip-types --no-warnings \
//     --import ./scripts/alias-loader.mjs scripts/calibrate-cover-letter-judge.ts \
//     [--model M] [--judge-model J] [--limit N]
//
// Env comes from the CLI flag, NOT process.loadEnvFile(): lib/db.ts THROWS at import
// time when DATABASE_URL is unset, and ESM imports hoist above any script body code —
// a body-level loadEnvFile (the gen-resume.ts pattern) would run too late here.
//
// --sync   reconcile cover_letter_edits → cover-letter-golden (re-push rows whose
//          on-save push failed). Syncs ALL rows regardless of superseded_at — a
//          superseded edit is still a valid (job context → ideal letter) pair.
// --run    (default) pull the dataset, REPLAY generateCoverLetter(input) per item,
//          judge each fresh letter against its golden reference (reference-based
//          rubric, run locally — NOT a LangFuse managed evaluator), print a report.
//          Recording a LangFuse dataset run is a deliberate follow-up (spec:
//          "optionally"); the report is the deliverable here.
//
// RUNNABILITY: --run imports the live generation chain, whose modules use `@/`
// imports throughout — hence the alias-loader --import (mirrors scripts/gen-resume.ts;
// calibrate-resume-judge.ts never touches the chain so it skips the loader). Do NOT
// "clean up" the .ts value-import extensions. Requires LANGFUSE_* + OPENROUTER_API_KEY
// + DATABASE_URL (.env.local or shell env).
import { LangfuseClient } from "@langfuse/client";
import { resolveLangfuseHost } from "../lib/langfuseHost.ts";
// serviceSql, not `sql` — lib/db.ts renamed the export in the go-public merge; the
// résumé calibrate script predates that. Scripts run operator-side with the direct
// connection, same trust level as calibrate-resume-judge.ts.
import { serviceSql } from "../lib/db.ts";
import { generateCoverLetter, DEFAULT_COVER_MODEL } from "../lib/rolefit/coverLetterClient.ts";
import { callOpenRouterStructured } from "../lib/rolefit/openrouterClient.ts";
import { composeCoverLetterText } from "../lib/rolefit/coverLetterText.ts";
import {
  COVER_LETTER_GOLDEN_DATASET_NAME,
  buildCoverLetterGoldenItem,
  coverLetterOverall,
  type CoverLetterGoldenInput,
} from "../lib/rolefit/coverLetterScore.ts";
import { upsertCoverLetterGoldenItem } from "../lib/coverLetterGoldenDataset.ts";
import { renderCoverLetterJudgePrompt } from "../lib/rolefit/coverLetterJudgeRubric.ts";

// OpenRouter slug for the judge (the résumé judge is also Sonnet — resumeJudgeRubric.ts).
const DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-5";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface EditRow {
  user_id: string; job_id: string; edited_text: string; original_text: string | null;
  cover_letter_trace_id: string | null; model: string | null; comment: string | null;
  edited_at: string; cover_letter_instructions: string | null;
  title: string; company_name: string; description: string | null;
  about: string | null; requirements: { text: string; met: boolean }[];
  skill_gaps: string[]; red_flags: string[];
  resume_text: string | null; full_name: string | null; model_cover: string | null;
}

async function loadEdits(): Promise<EditRow[]> {
  return (await serviceSql`
    SELECT e.user_id, e.job_id, e.edited_text, e.original_text, e.cover_letter_trace_id,
           e.model, e.comment, e.edited_at::text AS edited_at,
           ap.cover_letter_instructions,
           j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
           r.about,
           COALESCE(r.requirements, '[]'::jsonb) AS requirements,
           COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
           COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags,
           p.resume_text, p.full_name, p.model_cover
    FROM cover_letter_edits e
    JOIN jobs j       ON j.id = e.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN application_packages ap ON ap.user_id = e.user_id AND ap.job_id = e.job_id
    LEFT JOIN job_reviews r ON r.job_id = e.job_id AND r.user_id = e.user_id
    LEFT JOIN profiles p    ON p.user_id = e.user_id
    ORDER BY e.edited_at DESC
  `) as unknown as EditRow[];
}

function rowToInput(r: EditRow): CoverLetterGoldenInput {
  return {
    background: r.resume_text,
    candidateName: r.full_name,
    instructions: r.cover_letter_instructions,
    job: {
      title: r.title, company: r.company_name, description: r.description,
      about: r.about, requirements: r.requirements,
      skillGaps: r.skill_gaps, redFlags: r.red_flags,
    },
    model: r.model_cover,
  };
}

async function sync(): Promise<void> {
  const rows = await loadEdits();
  let n = 0;
  for (const r of rows) {
    await upsertCoverLetterGoldenItem(
      buildCoverLetterGoldenItem({
        userId: r.user_id, jobId: r.job_id, input: rowToInput(r),
        editedText: r.edited_text, comment: r.comment,
        traceId: r.cover_letter_trace_id, model: r.model,
        originalText: r.original_text, editedAt: r.edited_at,
      }),
    );
    n++;
  }
  console.log(`synced ${n} cover_letter_edits → ${COVER_LETTER_GOLDEN_DATASET_NAME}`);
}

function langfuse(): LangfuseClient {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    throw new Error("LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY required");
  }
  return new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: resolveLangfuseHost(),
  });
}

const JUDGE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "cover_letter_judge_scores",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["grounding", "jd_relevance", "fidelity"],
      properties: {
        grounding: { type: "integer", minimum: 1, maximum: 5 },
        jd_relevance: { type: "integer", minimum: 1, maximum: 5 },
        fidelity: { type: "integer", minimum: 1, maximum: 5 },
      },
    },
  },
} as const;

interface JudgeScores { grounding: number; jd_relevance: number; fidelity: number }

async function judge(args: {
  input: CoverLetterGoldenInput; generated: string; golden: string;
  judgeModel: string; apiKey: string;
}): Promise<JudgeScores> {
  const prompt = renderCoverLetterJudgePrompt({
    candidateBackground: args.input.background ?? "(none)",
    jobTitle: args.input.job.title,
    company: args.input.job.company,
    jobDescription: args.input.job.description ?? "(none)",
    coverLetter: args.generated,
    goldenLetter: args.golden,
  });
  return callOpenRouterStructured<JudgeScores>({
    generationName: "cover-letter-judge",
    label: "cover-letter judge",
    model: args.judgeModel,
    apiKey: args.apiKey,
    system: "You are a strict, consistent evaluation judge. Return only the requested JSON.",
    user: prompt,
    responseFormat: JUDGE_SCHEMA,
    maxTokens: 2000,
    parse: (raw) => {
      const s = raw as JudgeScores;
      for (const k of ["grounding", "jd_relevance", "fidelity"] as const) {
        if (typeof s[k] !== "number" || s[k] < 1 || s[k] > 5) {
          throw new Error(`judge returned bad ${k}: ${String(s[k])}`);
        }
      }
      return s;
    },
  });
}

// Dataset item shape as stored by upsertCoverLetterGoldenItem. The list accessor
// mirrors calibrate-resume-judge.ts's "verify SDK shape" hedge: if the client's
// pagination shape differs, adjust the accessor — the concept (page through items
// of one dataset) holds.
interface DatasetItem {
  id: string;
  input: CoverLetterGoldenInput;
  expectedOutput: { cover_letter: string; comment: string | null };
}

async function loadDatasetItems(c: LangfuseClient, limit: number): Promise<DatasetItem[]> {
  const out: DatasetItem[] = [];
  let page = 1;
  while (out.length < limit) {
    const res = (await c.api.datasetItems.list({
      datasetName: COVER_LETTER_GOLDEN_DATASET_NAME, page, limit: 50,
    })) as unknown as { data?: DatasetItem[]; meta?: { totalPages?: number } };
    const batch = res.data ?? [];
    out.push(...batch);
    if (batch.length === 0 || (res.meta?.totalPages !== undefined && page >= res.meta.totalPages)) break;
    page++;
  }
  return out.slice(0, limit);
}

async function run(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY required for --run");
  const judgeModel = argValue("--judge-model") ?? DEFAULT_JUDGE_MODEL;
  const modelOverride = argValue("--model");
  const limit = Number(argValue("--limit") ?? 50);

  const items = await loadDatasetItems(langfuse(), limit);
  if (items.length === 0) {
    console.log(`no items in ${COVER_LETTER_GOLDEN_DATASET_NAME} — run --sync (or save an edit) first`);
    return;
  }

  const agg = { grounding: 0, jd_relevance: 0, fidelity: 0, overall: 0, n: 0 };
  const lines: string[] = [];
  for (const item of items) {
    const input = item.input;
    if (!input?.background || !input.job?.title || !item.expectedOutput?.cover_letter) {
      console.warn(`skipping ${item.id}: incomplete replay input or missing golden cover_letter`);
      continue;
    }
    const model = modelOverride ?? input.model ?? DEFAULT_COVER_MODEL;
    const { letter } = await generateCoverLetter({
      resumeText: input.background,
      candidateName: input.candidateName,
      instructions: input.instructions,
      job: input.job,
      model,
      apiKey,
    });
    const generated = composeCoverLetterText(letter);
    const s = await judge({ input, generated, golden: item.expectedOutput.cover_letter, judgeModel, apiKey });
    const overall = coverLetterOverall(s.grounding, s.fidelity, s.jd_relevance);
    agg.grounding += s.grounding; agg.jd_relevance += s.jd_relevance;
    agg.fidelity += s.fidelity; agg.overall += overall; agg.n++;
    lines.push(
      `${item.id}  grounding=${s.grounding} fidelity=${s.fidelity} jd=${s.jd_relevance} overall=${overall} (gen model=${model})`,
    );
  }

  console.log(`=== cover-letter replay eval (judge: ${judgeModel}, n=${agg.n}) ===`);
  for (const l of lines) console.log("  " + l);
  if (agg.n > 0) {
    console.log(
      `means: grounding=${(agg.grounding / agg.n).toFixed(2)} fidelity=${(agg.fidelity / agg.n).toFixed(2)} ` +
      `jd_relevance=${(agg.jd_relevance / agg.n).toFixed(2)} overall=${(agg.overall / agg.n).toFixed(2)}`,
    );
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--sync")) await sync();
  else await run();
  await serviceSql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
