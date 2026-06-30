/**
 * Local résumé-iteration harness — generate a tailored résumé PDF without
 * deploying. Mirrors the production path in app/api/resume/route.ts:
 *   parseProfile(pdf/text) -> deterministic fixed fields
 *   + job(title/company/description) -> OpenRouter (tailored fields only)
 *   -> assembleResume -> PDF
 * using the SAME parseProfile + buildResumePrompt + TAILORED_RESUME_SCHEMA +
 * assembleResume + renderResumePdf, so edits to the parser, the prompt, or the
 * renderer are reflected here immediately.
 *
 * Run (no extra deps — Node 22 strips the types):
 *   node --experimental-strip-types --no-warnings scripts/gen-resume.ts [job] [--model M]
 *
 *   job      substring of a fixture filename (default: software-engineer-ii-ai)
 *   --model  override the model (default: scripts/fixtures/model.txt, then haiku)
 *   --list   list available job fixtures and exit
 *
 * Reads OPENROUTER_API_KEY from dashboard/.env.local. The profile is parsed from
 * scripts/fixtures/source.pdf (if present) with scripts/fixtures/profile.txt as
 * the background text / fallback. Job inputs come from scripts/fixtures/jobs/.
 * Outputs land in scripts/fixtures/out/ (gitignored).
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { jsPDF } from "jspdf";
import {
  buildResumePrompt,
  assembleResume,
  TAILORED_RESUME_SCHEMA,
  type TailoredContent,
} from "../lib/rolefit/resumeSchema.ts";
import { parseProfile, yearsOfExperience } from "../lib/rolefit/parseProfile.ts";
import { renderResumePdf } from "../lib/rolefit/resumePdf.ts";

process.loadEnvFile(".env.local");

const FIX = "scripts/fixtures";
const JOBS_DIR = `${FIX}/jobs`;
const OUT = `${FIX}/out`;
const SOURCE_PDF = `${FIX}/source.pdf`;
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

type JobFixture = { id: string; title: string; company: string; description: string | null };

function jobFiles(): string[] {
  return readdirSync(JOBS_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
}

function resolveJob(selector: string | undefined): { file: string; job: JobFixture } {
  const files = jobFiles();
  const file = !selector
    ? (files.find((f) => f.includes("software-engineer-ii-ai")) ?? files[0])
    : files.find((f) => f.toLowerCase().includes(selector.toLowerCase()));
  if (!file) {
    throw new Error(`No job fixture matches "${selector}". Available:\n  ${files.join("\n  ")}`);
  }
  return { file, job: JSON.parse(readFileSync(`${JOBS_DIR}/${file}`, "utf8")) as JobFixture };
}

async function main() {
  const argv = process.argv.slice(2);
  let selector: string | undefined;
  let model: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") {
      console.log("Job fixtures:\n  " + jobFiles().join("\n  "));
      return;
    } else if (a === "--model") {
      model = argv[++i];
    } else if (!a.startsWith("--")) {
      selector = a;
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set (expected in .env.local)");

  const resumeText = readFileSync(`${FIX}/profile.txt`, "utf8");
  model ??= (() => {
    try { return readFileSync(`${FIX}/model.txt`, "utf8").trim() || DEFAULT_MODEL; }
    catch { return DEFAULT_MODEL; }
  })();

  // Deterministic fixed fields — parsed once from the PDF (preferred) or text.
  const hasPdf = existsSync(SOURCE_PDF);
  const profile = await parseProfile({
    pdfBytes: hasPdf ? new Uint8Array(readFileSync(SOURCE_PDF)) : null,
    text: resumeText,
  });

  console.log(`Profile source: ${hasPdf ? SOURCE_PDF : `${FIX}/profile.txt`}`);
  console.log("Deterministic fields (identical across every job):");
  console.log(`  name:      ${profile.name}`);
  console.log(`  contact:   ${profile.contact}`);
  console.log(`  education: ${profile.educationEntries.join(" | ")}`);
  console.log(`  certs:     ${profile.certifications.join(" · ")}`);
  console.log(`  roles:     ${profile.experience.map((r) => `${r.role} @ ${r.company} (${r.dates})`).join(" | ")}`);

  const tenureYears = yearsOfExperience(profile, Date.now());
  console.log(`  tenure:    ${tenureYears === null ? "(unknown)" : `${tenureYears}+ years`}`);

  const { file, job } = resolveJob(selector);
  const { system, user } = buildResumePrompt({
    profile,
    resumeText,
    job: { title: job.title, company: job.company, description: job.description },
    tenureYears,
  });

  console.log(`\n→ job:   [${job.company}] ${job.title}  (${file})`);
  console.log(`→ model: ${model}`);
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "job-board" },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: TAILORED_RESUME_SCHEMA,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { completion_tokens?: number };
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  const tailored = JSON.parse(content) as TailoredContent;
  const data = assembleResume(profile, tailored);

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const scale = renderResumePdf(doc as never, data);

  mkdirSync(OUT, { recursive: true });
  const base = `${job.company}__${job.title}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const pdfPath = `${OUT}/${base}.pdf`;
  const jsonPath = `${OUT}/${base}.json`;
  writeFileSync(pdfPath, Buffer.from(doc.output("arraybuffer")));
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  // Diagnostics — the tailored shape that drives whether the page looks full/short.
  const bulletCounts = data.experience.map((e) => e.bullets.length);
  console.log(`\n✓ generated in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
    (json.usage?.completion_tokens ? ` (${json.usage.completion_tokens} output tokens)` : ""));
  console.log(`  scale used:  ${scale.toFixed(2)}  (1.00 = full size; <1 = shrunk to fit one page)`);
  console.log(`  headline:    ${data.headline}`);
  console.log(`  education:    ${JSON.stringify(data.education)}`);
  console.log(`  certs:       ${JSON.stringify(data.certifications)}`);
  console.log(`  summary:     ${data.summary.length} chars`);
  console.log(`  skills:      ${data.skills.length}`);
  console.log(`  experience:  ${data.experience.length} roles [${data.experience.map((e) => e.company).join(", ")}], bullets [${bulletCounts.join(", ")}]`);
  console.log(`  PDF:  ${pdfPath}`);
  console.log(`  JSON: ${jsonPath}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
