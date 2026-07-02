# Résumé-Generation Evals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build offline (human-scored golden dataset) and online (LangFuse-managed LLM-judge) evals for tailored-résumé generation, with a calibration loop and deterministic mechanical checks.

**Architecture:** Résumé generation is TypeScript in `dashboard/` and already emits a `resume-generation` LangFuse generation span. We wrap it in a parent `resume` observation (clean input/output for a UI-configured judge) and capture its trace id onto `application_packages`. An in-board scoring panel writes human scores (grounding + JD-relevance, 1–5) to a new `resume_scores` table and best-effort-pushes a `resume-golden` LangFuse dataset item — mirroring the existing reviewer-golden correction flow. A TS script joins human scores to the managed judge's trace scores for calibration. Deterministic mechanical checks run in code (anti-hallucination, length, dedup) and attach to the trace.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Postgres (postgres.js `sql` tagged template), `@langfuse/tracing` v5 (OTel-based) + `@langfuse/client` (both already installed), `@opentelemetry/api` (already present transitively), vitest.

## Global Constraints

- **LangFuse is on US cloud.** Traces/datasets land on `us.cloud.langfuse.com` via the `LANGFUSE_HOST` env. "No data" almost always means wrong region.
- **DB-first, best-effort LangFuse push.** Postgres write commits before any LangFuse call; a LangFuse failure returns `langfuseSynced: false` and is reconciled later — it never loses the human score. Mirror `dashboard/app/actions/corrections.ts`.
- **Deny-all RLS on every new table.** Follow `migrations/2026-06-26-rls-deny-all-policies.sql`: `ENABLE ROW LEVEL SECURITY` + one `FOR ALL USING (false) WITH CHECK (false)` policy. Access is via the service-role DIRECT connection only.
- **Migrations are idempotent + transactional + recorded.** `BEGIN`/`COMMIT`, `IF NOT EXISTS`, and `INSERT INTO schema_migrations (filename) VALUES ('<file>') ON CONFLICT DO NOTHING`. Mirror the migration into `schema.sql`.
- **Apply the migration to Supabase BEFORE deploying code that reads/writes the new table/column** (migration-coupled deploy order).
- **Judge model = Claude Sonnet 5** (configured in the LangFuse UI, not code). The exact LangFuse LLM-connection slug (e.g. `anthropic/claude-sonnet-5` on OpenRouter) is confirmed against the current model list when wiring the evaluator.
- **Rubric = 2 dimensions, 1–5:** `grounding` (traceable to real background — the #1 risk) and `jd_relevance` (selected/emphasized toward the role). **overall = `0.7*grounding + 0.3*jd_relevance`.**
- **Run all `npm`/`node` commands from `dashboard/`.** Tests: `npx vitest run <path>`. The dashboard needs `NEXT_PUBLIC_SUPABASE_*` in `.env.local` for dev, but the unit tests here are pure and DB-free.

---

## File Structure

**New files:**
- `migrations/2026-07-02-resume-scores.sql` — `resume_scores` table + `application_packages.resume_trace_id` column + RLS.
- `dashboard/lib/rolefit/resumeText.ts` — pure `composeResumeText(resume)` (extracted from `ResumePanel.tsx` so it's importable server-side).
- `dashboard/lib/rolefit/resumeChecks.ts` — pure `resumeChecks(resume, parsed?)` mechanical checks + `ResumeChecks` type.
- `dashboard/lib/rolefit/resumeScore.ts` — `ResumeScoreForm`/`ResumeScoreRow` types, `resumeOverall`, `buildResumeGoldenItem`, `RESUME_GOLDEN_DATASET_NAME`.
- `dashboard/lib/rolefit/resumeJudgeRubric.ts` — the exact judge prompt/rubric, versioned in-repo (LangFuse UI holds the running copy).
- `dashboard/lib/resumeGoldenDataset.ts` — `upsertResumeGoldenItem(item)` (LangFuse client, mirrors `langfuseDataset.ts`).
- `dashboard/app/actions/resumeScores.ts` — `saveResumeScore(jobId, form)` server action.
- `dashboard/components/rolefit/ResumeScorePanel.tsx` — in-board scoring UI (self-contained; calls the action directly).
- `dashboard/scripts/calibrate-resume-judge.ts` — calibration report + `--sync` backfill.
- Test files: `resumeText.test.ts`, `resumeChecks.test.ts`, `resumeScore.test.ts`, `resumeGoldenDataset.test.ts`, `resumeScore.action.test.ts` (all under `dashboard/lib/rolefit/` or `dashboard/lib/`).

**Modified files:**
- `dashboard/lib/rolefit/resumeClient.ts` — `generateResume` returns `{ resume, checks }`.
- `dashboard/app/api/resume/route.ts` — parent `resume` observation, trace-id capture, persist `resume_trace_id`.
- `dashboard/app/api/application/prepare/route.ts` — same trace-id capture for its résumé leg + destructure fix.
- `dashboard/lib/queries.ts` — `upsertApplicationPackage` accepts + writes `resumeTraceId`.
- `dashboard/components/rolefit/ResumePanel.tsx` — import `composeResumeText` from `resumeText.ts`; render `<ResumeScorePanel>` in the Done block.
- `schema.sql` — mirror the migration.

**Interfaces (defined once here, referenced by tasks):**
- `TailoredResume` (existing, `lib/rolefit/resumeSchema.ts`): `{ name, contact, headline, summary, skills: string[], experience: {role, company, dates, bullets: string[]}[], education: string[], certifications: string[] }`.
- `ParsedProfile` (existing, `lib/rolefit/parseProfile.ts`): `{ name, contact, educationEntries: string[], certifications: string[], experience: {role, company, dates, sourceBullets: string[]}[] }`.
- `ResumeChecks` (Task 3): `{ checks: { id: string; label: string; pass: boolean; detail?: string }[]; passCount: number; total: number }`.
- `resumeChecks(resume: TailoredResume, parsed?: ParsedProfile): ResumeChecks` (Task 3).
- `composeResumeText(resume: TailoredResume): string` (Task 2).
- `ResumeScoreForm` (Task 4): `{ grounding: number; jdRelevance: number; comment: string | null }`.
- `resumeOverall(grounding: number, jdRelevance: number): number` (Task 4).
- `buildResumeGoldenItem(args): ResumeGoldenItem` (Task 4); `upsertResumeGoldenItem(item): Promise<void>` (Task 6).
- `generateResume(args): Promise<{ resume: TailoredResume; checks: ResumeChecks }>` (Task 7).
- `saveResumeScore(jobId: string, form: ResumeScoreForm): Promise<{ ok: true; langfuseSynced: boolean }>` (Task 8).

---

### Task 1: Data model — `resume_scores` table + `resume_trace_id` column

**Files:**
- Create: `migrations/2026-07-02-resume-scores.sql`
- Modify: `schema.sql` (append table + column + RLS, mirroring the migration)
- Modify: `dashboard/lib/queries.ts` (`upsertApplicationPackage`)

**Interfaces:**
- Produces: `resume_scores(user_id, job_id, grounding, jd_relevance, comment, resume_trace_id, resume_snapshot, model, scored_at)`; `application_packages.resume_trace_id TEXT`.

- [ ] **Step 1: Write the migration**

Create `migrations/2026-07-02-resume-scores.sql`:

```sql
-- Résumé-generation eval golden dataset.
-- Human scores (grounding + JD-relevance, 1–5) over generated résumés, joined to
-- the managed judge's LangFuse trace via resume_trace_id. Overlay table; never
-- mutates application_packages. Keyed (user_id, job_id) — one score per résumé
-- per operator; re-scoring overwrites (last-write-wins).
BEGIN;

CREATE TABLE IF NOT EXISTS resume_scores (
  user_id          UUID NOT NULL,
  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
  comment          TEXT,
  resume_trace_id  TEXT,                                -- join key to the judge's trace score
  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- the exact TailoredResume scored
  model            TEXT,                                -- model that generated the scored résumé
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS idx_resume_scores_user ON resume_scores (user_id);

-- LangFuse trace id captured at generation, so a score can reference the judge's
-- trace even after the résumé is regenerated (resume_snapshot pins what was scored).
ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS resume_trace_id TEXT;

-- Deny-all RLS (access via the service-role DIRECT connection only).
ALTER TABLE resume_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_anon_access ON resume_scores;
CREATE POLICY no_anon_access ON resume_scores FOR ALL USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename) VALUES ('2026-07-02-resume-scores.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply the migration to the local test DB and verify**

Run (uses the local Postgres from the test env note — adjust the URL to your local DB):

```bash
psql "postgresql://postgres:postgres@localhost:55432/poller_test" -f migrations/2026-07-02-resume-scores.sql
psql "postgresql://postgres:postgres@localhost:55432/poller_test" -c "\d resume_scores" -c "\d application_packages" | grep -E "resume_scores|resume_trace_id"
```

Expected: `\d resume_scores` prints the table with the 9 columns and the PK; `application_packages` shows a `resume_trace_id | text` column.

- [ ] **Step 3: Mirror into `schema.sql`**

In `schema.sql`, immediately after the `application_packages` table definition (the block ending at `CREATE INDEX idx_application_packages_job ...`), add the `resume_trace_id` column to the `application_packages` `CREATE TABLE` (insert `  resume_trace_id      TEXT,` right after the `apply_url TEXT,` line), and add the new table:

```sql
-- Résumé-generation eval golden dataset (see migrations/2026-07-02-resume-scores.sql).
CREATE TABLE resume_scores (
  user_id          UUID NOT NULL,
  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
  comment          TEXT,
  resume_trace_id  TEXT,
  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  model            TEXT,
  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX idx_resume_scores_user ON resume_scores (user_id);
```

Then in the RLS block near the bottom of `schema.sql` (where each table gets `ENABLE ROW LEVEL SECURITY` + `no_anon_access`), add:

```sql
ALTER TABLE resume_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_anon_access ON resume_scores FOR ALL USING (false) WITH CHECK (false);
```

- [ ] **Step 4: Extend `upsertApplicationPackage` to write `resume_trace_id`**

In `dashboard/lib/queries.ts`, in `upsertApplicationPackage`:

1. Add to the `data` param object type (after `applyUrl: string | null;`):
```ts
    resumeTraceId?: string | null;
```
2. Add `resume_trace_id` to the INSERT column list (after `apply_url,`) and its value `${data.resumeTraceId ?? null}` in the VALUES tuple (after `${data.applyUrl},`).
3. Add to the `ON CONFLICT ... DO UPDATE SET` list:
```sql
      resume_trace_id      = EXCLUDED.resume_trace_id,
```

All existing callers omit `resumeTraceId` (optional) and keep working — the column is set to NULL for them until Task 7 wires it.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-07-02-resume-scores.sql schema.sql dashboard/lib/queries.ts
git commit -m "feat(evals): resume_scores table + application_packages.resume_trace_id"
```

---

### Task 2: Extract `composeResumeText` into a server-safe module

**Files:**
- Create: `dashboard/lib/rolefit/resumeText.ts`
- Create: `dashboard/lib/rolefit/resumeText.test.ts`
- Modify: `dashboard/components/rolefit/ResumePanel.tsx`

**Interfaces:**
- Produces: `composeResumeText(resume: TailoredResume): string` (pure; used by Task 7's trace output and Task 9 UI).

**Why:** `composeResumeText` currently lives inside `ResumePanel.tsx` (a `"use client"` module). Task 7 needs it in a server route, so it must move to a runtime-pure module.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/rolefit/resumeText.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeResumeText } from "./resumeText";
import type { TailoredResume } from "./resumeSchema";

const RESUME: TailoredResume = {
  name: "Ada Lovelace",
  contact: "ada@example.com",
  headline: "AI/ML Engineer | LLM systems",
  summary: "Senior engineer with 5+ years building ML platforms.",
  skills: ["Python", "PyTorch"],
  experience: [
    { role: "ML Engineer", company: "Acme", dates: "2021 – Present", bullets: ["Built X", "Shipped Y"] },
  ],
  education: ["BSc Computer Science"],
  certifications: ["AWS SA"],
};

describe("composeResumeText", () => {
  it("renders name, headline, summary, skills, experience, education, certs", () => {
    const t = composeResumeText(RESUME);
    expect(t).toContain("Ada Lovelace");
    expect(t).toContain("SUMMARY");
    expect(t).toContain("Python, PyTorch");
    expect(t).toContain("ML Engineer, Acme (2021 – Present)");
    expect(t).toContain("  - Built X");
    expect(t).toContain("Certifications: AWS SA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeText.test.ts`
Expected: FAIL — cannot find module `./resumeText`.

- [ ] **Step 3: Create the module**

Create `dashboard/lib/rolefit/resumeText.ts` (copy the body verbatim from `ResumePanel.tsx` lines 10–23):

```ts
// RUNTIME-PURE: imports only the TailoredResume type, so this is safe to import
// from the client bundle, server routes, and the CLI harness alike.
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

/** Plain-text résumé from a TailoredResume (used for copy, PDF fallback, and the
 *  LangFuse trace output the managed judge reads). */
export function composeResumeText(data: TailoredResume): string {
  let t = `${data.name}\n${data.headline}\n`;
  if (data.contact) t += `${data.contact}\n`;
  t += `\nSUMMARY\n${data.summary}\n\nCORE SKILLS\n${data.skills.join(", ")}\n\nEXPERIENCE\n`;
  data.experience.forEach((exp) => {
    t += `${exp.role}, ${exp.company} (${exp.dates})\n`;
    exp.bullets.forEach((b) => { t += `  - ${b}\n`; });
    t += "\n";
  });
  t += "EDUCATION\n";
  data.education.forEach((entry) => { t += `${entry}\n`; });
  if (data.certifications.length) t += `Certifications: ${data.certifications.join(" · ")}\n`;
  return t;
}
```

- [ ] **Step 4: Repoint `ResumePanel.tsx` to the shared module**

In `dashboard/components/rolefit/ResumePanel.tsx`:
1. Delete the local `function composeResumeText(...) { ... }` (lines 9–23).
2. Add an import near the top (after the `downloadPdf` import):
```ts
import { composeResumeText } from "@/lib/rolefit/resumeText";
```
3. Update the bottom re-export (line 418) from `export { composeResumeText, legacyCopy };` to `export { legacyCopy };` — and add a re-export of `composeResumeText` so `RolefitBoard.tsx` (which imports it from `./ResumePanel`) keeps working:
```ts
export { legacyCopy };
export { composeResumeText } from "@/lib/rolefit/resumeText";
```

- [ ] **Step 5: Run the test + typecheck**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeText.test.ts && npx tsc --noEmit`
Expected: test PASS; `tsc` clean (no unresolved `composeResumeText` in `ResumePanel`/`RolefitBoard`).

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/rolefit/resumeText.ts dashboard/lib/rolefit/resumeText.test.ts dashboard/components/rolefit/ResumePanel.tsx
git commit -m "refactor(resume): extract composeResumeText into a runtime-pure module"
```

---

### Task 3: Deterministic mechanical checks

**Files:**
- Create: `dashboard/lib/rolefit/resumeChecks.ts`
- Create: `dashboard/lib/rolefit/resumeChecks.test.ts`

**Interfaces:**
- Consumes: `TailoredResume`, `ParsedProfile`.
- Produces: `resumeChecks(resume: TailoredResume, parsed?: ParsedProfile): ResumeChecks`. Profile-dependent checks (all-roles-present, no-foreign-company) are included only when `parsed` is passed. The résumé-only checks always run — so the client can call `resumeChecks(resume)` with no profile.

- [ ] **Step 1: Write the failing tests**

Create `dashboard/lib/rolefit/resumeChecks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resumeChecks } from "./resumeChecks";
import type { TailoredResume } from "./resumeSchema";
import type { ParsedProfile } from "./parseProfile";

function base(): TailoredResume {
  return {
    name: "A", contact: "a@x.com", headline: "Engineer | infra",
    summary: "Senior engineer.",
    skills: ["Python", "Go", "AWS", "Docker", "Kubernetes", "Postgres",
             "Redis", "React", "TypeScript", "Node.js", "GraphQL", "Terraform"],
    experience: [{ role: "Eng", company: "Acme", dates: "2021 – Present",
                   bullets: ["Built the platform", "Shipped the API"] }],
    education: ["BSc"], certifications: [],
  };
}
function parsed(): ParsedProfile {
  return { name: "A", contact: "", educationEntries: ["BSc"], certifications: [],
    experience: [{ role: "Eng", company: "Acme", dates: "2021 – Present", sourceBullets: [] }] };
}

describe("resumeChecks — résumé-only", () => {
  it("passes a clean résumé", () => {
    const r = resumeChecks(base());
    expect(r.checks.find((c) => c.id === "skills_count")?.pass).toBe(true);
  });
  it("flags <12 or >16 skills", () => {
    const r = base(); r.skills = ["Python", "Go"];
    expect(resumeChecks(r).checks.find((c) => c.id === "skills_count")?.pass).toBe(false);
  });
  it("flags a repeated opening verb across bullets", () => {
    const r = base();
    r.experience[0].bullets = ["Built the platform", "Built the API"];
    expect(resumeChecks(r).checks.find((c) => c.id === "verb_repeat")?.pass).toBe(false);
  });
  it("flags duplicate/subsuming skills (AWS + AWS S3)", () => {
    const r = base(); r.skills = [...r.skills.slice(0, 11), "AWS S3"];
    expect(resumeChecks(r).checks.find((c) => c.id === "skills_dedup")?.pass).toBe(false);
  });
  it("flags a bullet over 24 words", () => {
    const r = base();
    r.experience[0].bullets = ["word ".repeat(25).trim(), "Shipped the API"];
    expect(resumeChecks(r).checks.find((c) => c.id === "bullet_length")?.pass).toBe(false);
  });
  it("flags a summary over 70 words", () => {
    const r = base(); r.summary = "word ".repeat(71).trim();
    expect(resumeChecks(r).checks.find((c) => c.id === "summary_length")?.pass).toBe(false);
  });
  it("omits profile-dependent checks when no profile is passed", () => {
    expect(resumeChecks(base()).checks.find((c) => c.id === "roles_present")).toBeUndefined();
  });
});

describe("resumeChecks — with profile", () => {
  it("passes when roles match in order and no foreign company", () => {
    const r = resumeChecks(base(), parsed());
    expect(r.checks.find((c) => c.id === "roles_present")?.pass).toBe(true);
    expect(r.checks.find((c) => c.id === "no_foreign_company")?.pass).toBe(true);
  });
  it("flags a foreign company not in the profile", () => {
    const res = base(); res.experience[0].company = "Globex";
    expect(resumeChecks(res, parsed()).checks.find((c) => c.id === "no_foreign_company")?.pass).toBe(false);
  });
  it("flags a missing/extra role vs the profile", () => {
    const res = base();
    res.experience.push({ role: "X", company: "Y", dates: "", bullets: [] });
    expect(resumeChecks(res, parsed()).checks.find((c) => c.id === "roles_present")?.pass).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeChecks.test.ts`
Expected: FAIL — cannot find module `./resumeChecks`.

- [ ] **Step 3: Implement the module**

Create `dashboard/lib/rolefit/resumeChecks.ts`:

```ts
// RUNTIME-PURE deterministic mechanical checks over a generated résumé, derived
// from the generation contract in resumeSchema.ts. Subjective quality (grounding,
// JD-relevance) is scored by the LLM-judge; these catch the mechanical failures.
// Profile-dependent checks (anti-hallucination, roles-in-order) only run when a
// ParsedProfile is passed, so the client can call resumeChecks(resume) alone.
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { ParsedProfile } from "@/lib/rolefit/parseProfile";

export interface ResumeCheck {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
}
export interface ResumeChecks {
  checks: ResumeCheck[];
  passCount: number;
  total: number;
}

const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0);
const firstVerb = (bullet: string): string =>
  (bullet.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
const normSkill = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function resumeChecks(resume: TailoredResume, parsed?: ParsedProfile): ResumeChecks {
  const checks: ResumeCheck[] = [];
  const bullets = resume.experience.flatMap((e) => e.bullets);

  // Skills count 12–16.
  checks.push({
    id: "skills_count",
    label: "12–16 skills",
    pass: resume.skills.length >= 12 && resume.skills.length <= 16,
    detail: `${resume.skills.length} skills`,
  });

  // No duplicate/subsuming skill (e.g. "AWS" and "AWS S3").
  const skillDup = (() => {
    const norm = resume.skills.map(normSkill);
    for (let i = 0; i < norm.length; i++) {
      for (let j = 0; j < norm.length; j++) {
        if (i === j || !norm[i] || !norm[j]) continue;
        if (norm[i] === norm[j] && i < j) return resume.skills[i];
        // subsuming: one skill's tokens are a superset containing the other whole
        if (norm[i] !== norm[j] && (` ${norm[i]} `).includes(` ${norm[j]} `)) return resume.skills[j];
      }
    }
    return null;
  })();
  checks.push({
    id: "skills_dedup",
    label: "no duplicate/subsuming skills",
    pass: skillDup === null,
    detail: skillDup ? `duplicate: ${skillDup}` : undefined,
  });

  // No repeated opening verb across ALL bullets.
  const verbs = bullets.map(firstVerb).filter(Boolean);
  const repeatedVerb = verbs.find((v, i) => verbs.indexOf(v) !== i) ?? null;
  checks.push({
    id: "verb_repeat",
    label: "unique opening verbs",
    pass: repeatedVerb === null,
    detail: repeatedVerb ? `repeated: ${repeatedVerb}` : undefined,
  });

  // Each bullet ≤24 words.
  const longBullet = bullets.find((b) => wordCount(b) > 24) ?? null;
  checks.push({
    id: "bullet_length",
    label: "bullets ≤24 words",
    pass: longBullet === null,
    detail: longBullet ? `${wordCount(longBullet)} words` : undefined,
  });

  // Summary ≤70 words.
  const sw = wordCount(resume.summary);
  checks.push({ id: "summary_length", label: "summary ≤70 words", pass: sw <= 70, detail: `${sw} words` });

  // Headline ≤55 chars (deterministic role-title portion may push it; heuristic guard).
  checks.push({
    id: "headline_length",
    label: "headline ≤80 chars",
    pass: resume.headline.length <= 80,
    detail: `${resume.headline.length} chars`,
  });

  // Per-role bullet counts 2–7 (roles with source material).
  const badRole = resume.experience.find((e) => e.bullets.length > 7) ?? null;
  checks.push({
    id: "bullets_per_role",
    label: "≤7 bullets per role",
    pass: badRole === null,
    detail: badRole ? `${badRole.company}: ${badRole.bullets.length}` : undefined,
  });

  // One-page volume heuristic: total bullets within a sane band.
  checks.push({
    id: "one_page_fit",
    label: "one-page volume (≤24 bullets)",
    pass: bullets.length <= 24,
    detail: `${bullets.length} bullets`,
  });

  // Profile-dependent (anti-hallucination) — only when a profile is available.
  if (parsed) {
    const rolesOk =
      resume.experience.length === parsed.experience.length &&
      resume.experience.every((e, i) => {
        const p = parsed.experience[i];
        return p && normSkill(e.company).startsWith(normSkill(p.company).split(" ")[0] ?? "");
      });
    checks.push({
      id: "roles_present",
      label: "all profile roles present, in order",
      pass: rolesOk,
      detail: rolesOk ? undefined : `${resume.experience.length} vs ${parsed.experience.length} roles`,
    });

    const profileCompanies = parsed.experience.map((r) => normSkill(r.company));
    const foreign = resume.experience.find(
      (e) => !profileCompanies.some((pc) => pc && (normSkill(e.company).includes(pc) || pc.includes(normSkill(e.company)))),
    );
    checks.push({
      id: "no_foreign_company",
      label: "no company outside the profile",
      pass: !foreign,
      detail: foreign ? `foreign: ${foreign.company}` : undefined,
    });
  }

  const passCount = checks.filter((c) => c.pass).length;
  return { checks, passCount, total: checks.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeChecks.test.ts`
Expected: all PASS. If `roles_present` or `no_foreign_company` fails on the clean case, confirm the `normSkill` company comparison — "Acme" vs "Acme" normalizes equal.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/resumeChecks.ts dashboard/lib/rolefit/resumeChecks.test.ts
git commit -m "feat(evals): deterministic résumé mechanical checks"
```

---

### Task 4: Score types, overall weight, and golden-item builder

**Files:**
- Create: `dashboard/lib/rolefit/resumeScore.ts`
- Create: `dashboard/lib/rolefit/resumeScore.test.ts`

**Interfaces:**
- Produces: `ResumeScoreForm`, `ResumeScoreRow`, `ResumeGoldenInput`, `ResumeGoldenItem`, `RESUME_GOLDEN_DATASET_NAME`, `resumeOverall(g, jd)`, `buildResumeGoldenItem(args)`.

- [ ] **Step 1: Write the failing tests**

Create `dashboard/lib/rolefit/resumeScore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resumeOverall, buildResumeGoldenItem, RESUME_GOLDEN_DATASET_NAME } from "./resumeScore";

describe("resumeOverall", () => {
  it("weights grounding 0.7 / jd 0.3, one decimal", () => {
    expect(resumeOverall(5, 5)).toBe(5);
    expect(resumeOverall(5, 1)).toBe(3.8); // 0.7*5 + 0.3*1 = 3.8
    expect(resumeOverall(1, 5)).toBe(2.2); // 0.7*1 + 0.3*5 = 2.2
  });
});

describe("buildResumeGoldenItem", () => {
  it("builds a deterministic golden item", () => {
    const item = buildResumeGoldenItem({
      userId: "u1", jobId: "j1",
      input: { title: "Eng", company: "Acme", description: "desc", background: "bg", model: "m" },
      form: { grounding: 4, jdRelevance: 3, comment: "solid" },
      traceId: "tr1", model: "m", scoredAt: "2026-07-02T00:00:00Z",
    });
    expect(item.id).toBe("u1:j1");
    expect(item.datasetName).toBe(RESUME_GOLDEN_DATASET_NAME);
    expect(item.input.title).toBe("Eng");
    expect(item.expectedOutput).toEqual({ grounding: 4, jd_relevance: 3, comment: "solid", overall: 3.7 });
    expect(item.metadata).toEqual({ resume_trace_id: "tr1", model: "m", scored_at: "2026-07-02T00:00:00Z", source: "dashboard" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeScore.test.ts`
Expected: FAIL — cannot find module `./resumeScore`.

- [ ] **Step 3: Implement the module**

Create `dashboard/lib/rolefit/resumeScore.ts`:

```ts
// Résumé golden-dataset scoring types + builders. Mirrors lib/rolefit/correction.ts
// (the reviewer-golden equivalent). Runtime-pure — no DB or LangFuse imports.

export const RESUME_GOLDEN_DATASET_NAME = "resume-golden";

// grounding 0.7 / jd_relevance 0.3 — fabrication is the dominant failure.
export const GROUNDING_WEIGHT = 0.7;
export const JD_RELEVANCE_WEIGHT = 0.3;

/** Weighted overall (1–5), rounded to one decimal. */
export function resumeOverall(grounding: number, jdRelevance: number): number {
  return Math.round((GROUNDING_WEIGHT * grounding + JD_RELEVANCE_WEIGHT * jdRelevance) * 10) / 10;
}

/** Client → server-action payload. */
export interface ResumeScoreForm {
  grounding: number;    // 1–5
  jdRelevance: number;  // 1–5
  comment: string | null;
}

/** Row shape for the resume_scores upsert. */
export interface ResumeScoreRow {
  grounding: number;
  jd_relevance: number;
  comment: string | null;
}

export function formToScoreRow(f: ResumeScoreForm): ResumeScoreRow {
  return { grounding: f.grounding, jd_relevance: f.jdRelevance, comment: f.comment };
}

/** The generation inputs stored on the golden item (enough to re-generate later). */
export interface ResumeGoldenInput {
  title: string;
  company: string;
  description: string | null;
  background: string | null;
  model: string | null;
}

export interface ResumeGoldenItem {
  id: string;
  datasetName: string;
  input: ResumeGoldenInput;
  expectedOutput: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export function buildResumeGoldenItem(args: {
  userId: string;
  jobId: string;
  input: ResumeGoldenInput;
  form: ResumeScoreForm;
  traceId: string | null;
  model: string | null;
  scoredAt: string;
}): ResumeGoldenItem {
  return {
    id: `${args.userId}:${args.jobId}`,
    datasetName: RESUME_GOLDEN_DATASET_NAME,
    input: args.input,
    expectedOutput: {
      grounding: args.form.grounding,
      jd_relevance: args.form.jdRelevance,
      comment: args.form.comment,
      overall: resumeOverall(args.form.grounding, args.form.jdRelevance),
    },
    metadata: {
      resume_trace_id: args.traceId,
      model: args.model,
      scored_at: args.scoredAt,
      source: "dashboard",
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeScore.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/resumeScore.ts dashboard/lib/rolefit/resumeScore.test.ts
git commit -m "feat(evals): résumé score types + golden-item builder (0.7/0.3 overall)"
```

---

### Task 5: In-repo judge rubric reference

**Files:**
- Create: `dashboard/lib/rolefit/resumeJudgeRubric.ts`

**Interfaces:**
- Produces: `RESUME_JUDGE_RUBRIC` (string) — the exact judge prompt, versioned in-repo. LangFuse UI holds the *running* copy; this is the source of truth.

**Why:** The online judge is LangFuse-managed (configured in the UI), but the rubric must be git-versioned and reviewable. Nothing imports this in the request path; the calibration script and Task 11 reference it.

- [ ] **Step 1: Create the reference constant**

Create `dashboard/lib/rolefit/resumeJudgeRubric.ts`:

```ts
// SOURCE OF TRUTH for the résumé LLM-judge rubric. The running copy is configured
// in the LangFuse UI (Evaluators). Keep this in sync when the UI rubric changes.
// Judge model: Claude Sonnet 5 (LangFuse LLM-connection slug confirmed at wiring).
// Two dimensions, 1–5. Overall (0.7*grounding + 0.3*jd_relevance) is computed in
// code (lib/rolefit/resumeScore.ts::resumeOverall), NOT by the judge.
//
// The evaluator maps two variables from the parent `resume` trace observation:
//   {{job_description}} ← trace input.description (+ title/company)
//   {{resume}}          ← trace output (rendered résumé text)

export const RESUME_JUDGE_GROUNDING_SCORE_NAME = "grounding";
export const RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME = "jd_relevance";

export const RESUME_JUDGE_RUBRIC = `You are a strict résumé-quality judge. You are given a target job and a generated, tailored résumé. Score the résumé on TWO dimensions, each an integer 1–5. Return ONLY JSON: {"grounding": <1-5>, "jd_relevance": <1-5>}.

TARGET JOB:
Title: {{job_title}} at {{job_company}}
Description: {{job_description}}

GENERATED RÉSUMÉ:
{{resume}}

DIMENSION 1 — grounding (truthfulness): Every claim must be traceable to a real candidate background. Penalize invented or inflated metrics, titles, employers, dates, degrees, technologies, or claimed industry/domain experience. 5 = nothing appears fabricated; 1 = clear fabrication/inflation. When uncertain whether a specific claim is invented, lean lower — fabrication is the worst failure.

DIMENSION 2 — jd_relevance (targeting): Content is selected and emphasized toward THIS role — the most relevant experience leads and gets the most space, genuinely-matched terminology is mirrored, and irrelevant material is de-emphasized. Penalize narration ("directly analogous to…"), keyword-stuffing, and generic one-size-fits-all résumés. 5 = sharply targeted; 1 = untargeted.

Return only the JSON object.`;
```

- [ ] **Step 2: Verify it parses (typecheck)**

Run: `cd dashboard && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/rolefit/resumeJudgeRubric.ts
git commit -m "docs(evals): in-repo résumé judge rubric reference"
```

---

### Task 6: LangFuse golden-dataset upsert helper

**Files:**
- Create: `dashboard/lib/resumeGoldenDataset.ts`
- Create: `dashboard/lib/resumeGoldenDataset.test.ts`

**Interfaces:**
- Consumes: `ResumeGoldenItem` (Task 4).
- Produces: `upsertResumeGoldenItem(item: ResumeGoldenItem): Promise<void>` — no-op when `LANGFUSE_*` keys are absent; upserts by `id` (re-scores replace in place).

**Note:** Self-contained LangFuse client (mirrors `lib/langfuseDataset.ts`); the ~12-line client singleton is intentionally duplicated to avoid modifying the reviewer's working `langfuseDataset.ts`.

- [ ] **Step 1: Write the failing test**

Create `dashboard/lib/resumeGoldenDataset.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertResumeGoldenItem } from "./resumeGoldenDataset";
import type { ResumeGoldenItem } from "./rolefit/resumeScore";

const ITEM: ResumeGoldenItem = {
  id: "u1:j1", datasetName: "resume-golden",
  input: { title: "Eng", company: "Acme", description: "d", background: "b", model: "m" },
  expectedOutput: { grounding: 4, jd_relevance: 3, comment: null, overall: 3.7 },
  metadata: { resume_trace_id: "tr1", model: "m", scored_at: "2026-07-02T00:00:00Z", source: "dashboard" },
};

describe("upsertResumeGoldenItem", () => {
  const saved = { pub: process.env.LANGFUSE_PUBLIC_KEY, sec: process.env.LANGFUSE_SECRET_KEY };
  beforeEach(() => { delete process.env.LANGFUSE_PUBLIC_KEY; delete process.env.LANGFUSE_SECRET_KEY; });
  afterEach(() => { process.env.LANGFUSE_PUBLIC_KEY = saved.pub; process.env.LANGFUSE_SECRET_KEY = saved.sec; });

  it("is a no-op (resolves) when LangFuse keys are absent", async () => {
    await expect(upsertResumeGoldenItem(ITEM)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run lib/resumeGoldenDataset.test.ts`
Expected: FAIL — cannot find module `./resumeGoldenDataset`.

- [ ] **Step 3: Implement the helper**

Create `dashboard/lib/resumeGoldenDataset.ts` (mirrors `lib/langfuseDataset.ts`):

```ts
import { LangfuseClient } from "@langfuse/client";
import type { ResumeGoldenItem } from "@/lib/rolefit/resumeScore";

let client: LangfuseClient | null = null;

function getClient(): LangfuseClient | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return null;
  if (!client) {
    client = new LangfuseClient({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });
  }
  return client;
}

// Upsert one resume-golden dataset item. No-op when keys are absent (local/dev).
// Same id re-upserts (LangFuse upserts on `id`), so re-scoring updates in place.
export async function upsertResumeGoldenItem(item: ResumeGoldenItem): Promise<void> {
  const c = getClient();
  if (c === null) return;
  try {
    await c.api.datasets.create({ name: item.datasetName });
  } catch {
    /* dataset already exists */
  }
  await c.api.datasetItems.create({
    datasetName: item.datasetName,
    id: item.id,
    input: item.input,
    expectedOutput: item.expectedOutput,
    metadata: item.metadata,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npx vitest run lib/resumeGoldenDataset.test.ts`
Expected: PASS (no-op path; no network).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/resumeGoldenDataset.ts dashboard/lib/resumeGoldenDataset.test.ts
git commit -m "feat(evals): resume-golden LangFuse dataset upsert helper"
```

---

### Task 7: Instrument generation — checks + parent trace + trace-id capture

**Files:**
- Modify: `dashboard/lib/rolefit/resumeClient.ts` (return `{ resume, checks }`)
- Modify: `dashboard/app/api/resume/route.ts`
- Modify: `dashboard/app/api/application/prepare/route.ts`

**Interfaces:**
- Consumes: `resumeChecks` (Task 3), `composeResumeText` (Task 2), `upsertApplicationPackage` w/ `resumeTraceId` (Task 1).
- Produces: `generateResume(args): Promise<{ resume: TailoredResume; checks: ResumeChecks }>`; both routes persist `resume_trace_id` on the package.

- [ ] **Step 1: Change `generateResume` to return `{ resume, checks }`**

In `dashboard/lib/rolefit/resumeClient.ts`:
1. Add imports:
```ts
import { resumeChecks, type ResumeChecks } from "@/lib/rolefit/resumeChecks";
```
2. Change the return type to `Promise<{ resume: TailoredResume; checks: ResumeChecks }>`.
3. Capture the assembled résumé and compute checks. Replace the `return callOpenRouterStructured<...>({ ... })` with:
```ts
  const resume = await callOpenRouterStructured<TailoredResume>({
    generationName: "resume-generation",
    label: "résumé",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: TAILORED_RESUME_SCHEMA,
    maxTokens: 4000,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const tailored = raw as TailoredContent;
      if (!tailored.headlineFocus || !Array.isArray(tailored.experience)) {
        throw new Error("OpenRouter résumé missing required fields");
      }
      return assembleResume(profile, tailored);
    },
  });
  return { resume, checks: resumeChecks(resume, profile) };
```

- [ ] **Step 2: Update the `resumeClient` test to the new shape**

Open `dashboard/lib/rolefit/resumeClient.test.ts`. Every assertion that used the direct `TailoredResume` return must destructure `{ resume }`. Find each `const result = await generateResume(...)` (or similar) and change downstream `result.name` → `result.resume.name`, etc. Add one assertion:
```ts
    const { resume, checks } = await generateResume(/* existing args */);
    expect(resume.name).toBeDefined();
    expect(checks.total).toBeGreaterThan(0);
```

- [ ] **Step 3: Run the resumeClient test to verify it passes**

Run: `cd dashboard && npx vitest run lib/rolefit/resumeClient.test.ts`
Expected: PASS with the new `{ resume, checks }` shape.

- [ ] **Step 4: Instrument `/api/resume/route.ts`**

In `dashboard/app/api/resume/route.ts`:
1. Add imports:
```ts
import { startActiveObservation } from "@langfuse/tracing";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { ResumeChecks } from "@/lib/rolefit/resumeChecks";
```
2. Replace the `run` body's generation region (lines ~31–48, the `try { const resume = await generateResume(...); const pkg = await upsertApplicationPackage(...); return Response.json({ package: pkg }); }`) with:
```ts
  const run = async () => {
    try {
      let traceId: string | null = null;
      const generate = async (): Promise<{ resume: TailoredResume; checks: ResumeChecks }> =>
        generateResume({
          resumeText,
          pdfBytes,
          job: { title: job.title, company: job.company_name, description: job.description },
          model: profile.model_resume ?? DEFAULT_RESUME_MODEL,
          apiKey,
        });

      let result: { resume: TailoredResume; checks: ResumeChecks };
      if (tracingEnabled()) {
        // Parent `resume` observation: clean input/output the managed judge targets,
        // and the trace whose id links human scores to judge scores. The nested
        // `resume-generation` span records inside this active trace.
        result = await startActiveObservation(
          "resume",
          async (span) => {
            traceId = span.traceId;
            span.update({
              input: { title: job.title, company: job.company_name, description: job.description },
            });
            const r = await generate();
            span.update({
              output: composeResumeText(r.resume),
              metadata: { mechanical_checks: r.checks },
            });
            return r;
          },
          { asType: "span" },
        );
      } else {
        result = await generate();
      }

      const pkg = await upsertApplicationPackage(userId, jobId, {
        resume: result.resume,
        coverLetter: null,
        answersSnapshot: null,
        greenhouseQuestions: null,
        prefilledAnswers: null,
        applyUrl: null,
        resumeTraceId: traceId,
      });
      return Response.json({ package: pkg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("truncated")) return Response.json({ error: "Résumé generation truncated — try again with a shorter résumé." }, { status: 502 });
      if (msg.includes("429") || msg.includes("rate")) return Response.json({ error: "Rate limited — try again in a moment." }, { status: 429 });
      if (msg.includes("402")) return Response.json({ error: "Insufficient credits." }, { status: 502 });
      return Response.json({ error: "Generation failed — try again." }, { status: 502 });
    }
  };
```

- [ ] **Step 5: Instrument the résumé leg of `/api/application/prepare/route.ts`**

In `dashboard/app/api/application/prepare/route.ts`:
1. Add imports:
```ts
import { startActiveObservation } from "@langfuse/tracing";
import { composeResumeText } from "@/lib/rolefit/resumeText";
```
2. The résumé is generated inside a `Promise.all([...])` (line ~89, `generateResume({...})`). Replace that array element with an inline wrapper that captures the trace id into an outer `let resumeTraceId: string | null = null;` (declare it just before the `Promise.all`). The `Promise.all` currently destructures `[resume, coverLetter]` (or similar) — the résumé element becomes:
```ts
      // résumé leg — wrapped so the managed judge has a clean `resume` trace and
      // we capture its trace id for the golden-dataset join.
      (async () => {
        if (!tracingEnabled()) return (await generateResume({ /* existing args verbatim */ })).resume;
        return startActiveObservation(
          "resume",
          async (span) => {
            resumeTraceId = span.traceId;
            span.update({ input: { title: job.title, company: job.company_name, description: job.description } });
            const r = await generateResume({ /* existing args verbatim */ });
            span.update({ output: composeResumeText(r.resume), metadata: { mechanical_checks: r.checks } });
            return r.resume;
          },
          { asType: "span" },
        );
      })(),
```
   Copy the existing `generateResume({...})` argument object verbatim into both call sites above. `tracingEnabled` is already imported in this route (it wraps `run` with `propagateAttributes`); if not, add `import { tracingEnabled } from "@/lib/observability";`.
3. In the `upsertApplicationPackage(userId, jobId, { ... })` call (line ~124), add `resumeTraceId,` to the data object.
4. If any other `generateResume(...)` result in this file is used directly as a `TailoredResume`, ensure it now reads `.resume` (the wrapper above already returns `.resume`, so the `Promise.all` destructured `resume` variable stays a `TailoredResume`).

- [ ] **Step 6: Typecheck + run the résumé route/client tests**

Run: `cd dashboard && npx tsc --noEmit && npx vitest run lib/rolefit/resumeClient.test.ts`
Expected: `tsc` clean; tests PASS. If `tsc` flags a `generateResume(...)` used as `TailoredResume`, add `.resume` at that site.

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/rolefit/resumeClient.ts dashboard/lib/rolefit/resumeClient.test.ts dashboard/app/api/resume/route.ts dashboard/app/api/application/prepare/route.ts
git commit -m "feat(evals): parent resume trace + mechanical checks + trace-id capture"
```

---

### Task 8: `saveResumeScore` server action

**Files:**
- Create: `dashboard/app/actions/resumeScores.ts`
- Create: `dashboard/lib/resumeScore.action.test.ts`

**Interfaces:**
- Consumes: `formToScoreRow`, `buildResumeGoldenItem` (Task 4), `upsertResumeGoldenItem` (Task 6), `requireUserId`, `sql`.
- Produces: `saveResumeScore(jobId: string, form: ResumeScoreForm): Promise<{ ok: true; langfuseSynced: boolean }>`.

- [ ] **Step 1: Write the failing test (payload builder is the pure seam)**

The action itself is DB-coupled; test the LangFuse-item construction it delegates to (already covered in Task 4) plus a guard test that a missing package throws. Create `dashboard/lib/resumeScore.action.test.ts` mirroring `dashboard/lib/corrections.action.test.ts`'s mocking style (mock `@/lib/db`, `@/lib/auth`, `@/lib/resumeGoldenDataset`, `next/cache`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn();
vi.mock("@/lib/db", () => ({ sql: Object.assign((...a: unknown[]) => sqlMock(...a), { json: (v: unknown) => v }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: vi.fn(async () => "u1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const upsertMock = vi.fn(async () => undefined);
vi.mock("@/lib/resumeGoldenDataset", () => ({ upsertResumeGoldenItem: (...a: unknown[]) => upsertMock(...a) }));

import { saveResumeScore } from "@/app/actions/resumeScores";

beforeEach(() => { sqlMock.mockReset(); upsertMock.mockReset(); upsertMock.mockResolvedValue(undefined); });

describe("saveResumeScore", () => {
  it("throws when no résumé package exists for the job", async () => {
    sqlMock.mockResolvedValueOnce([]);        // SELECT package/inputs → none
    await expect(saveResumeScore("j1", { grounding: 4, jdRelevance: 3, comment: null }))
      .rejects.toThrow(/no résumé/i);
  });

  it("writes the row, pushes the golden item, returns langfuseSynced=true", async () => {
    sqlMock
      .mockResolvedValueOnce([{ resume_json: { name: "A" }, resume_trace_id: "tr1", title: "Eng",
                                company_name: "Acme", description: "d", resume_text: "bg", model_resume: "m" }]) // SELECT
      .mockResolvedValueOnce(undefined); // INSERT ... ON CONFLICT
    const res = await saveResumeScore("j1", { grounding: 5, jdRelevance: 4, comment: "great" });
    expect(res).toEqual({ ok: true, langfuseSynced: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    const item = upsertMock.mock.calls[0][0] as { id: string; expectedOutput: Record<string, unknown> };
    expect(item.id).toBe("u1:j1");
    expect(item.expectedOutput.overall).toBe(4.7); // 0.7*5 + 0.3*4
  });

  it("returns langfuseSynced=false when the push throws (DB already committed)", async () => {
    sqlMock
      .mockResolvedValueOnce([{ resume_json: { name: "A" }, resume_trace_id: null, title: "Eng",
                                company_name: "Acme", description: "d", resume_text: "bg", model_resume: "m" }])
      .mockResolvedValueOnce(undefined);
    upsertMock.mockRejectedValueOnce(new Error("langfuse down"));
    const res = await saveResumeScore("j1", { grounding: 3, jdRelevance: 3, comment: null });
    expect(res).toEqual({ ok: true, langfuseSynced: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npx vitest run lib/resumeScore.action.test.ts`
Expected: FAIL — cannot find module `@/app/actions/resumeScores`.

- [ ] **Step 3: Implement the action**

Create `dashboard/app/actions/resumeScores.ts` (mirrors `app/actions/corrections.ts`):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { formToScoreRow, buildResumeGoldenItem, type ResumeScoreForm } from "@/lib/rolefit/resumeScore";
import { upsertResumeGoldenItem } from "@/lib/resumeGoldenDataset";

// Persist a human résumé score (grounding + JD-relevance, 1–5) and push it to the
// LangFuse `resume-golden` dataset. DB commits first, so a LangFuse failure never
// loses the score — it returns langfuseSynced=false and is reconciled by
// `node scripts/calibrate-resume-judge.ts --sync`.
export async function saveResumeScore(
  jobId: string,
  form: ResumeScoreForm,
): Promise<{ ok: true; langfuseSynced: boolean }> {
  const userId = await requireUserId();
  const row = formToScoreRow(form);

  // Snapshot the exact résumé scored + capture the trace id and generation inputs.
  const rows = await sql`
    SELECT ap.resume_json, ap.resume_trace_id,
           j.title, c.name AS company_name, j.description,
           p.resume_text, p.model_resume
    FROM application_packages ap
    JOIN jobs j       ON j.id = ap.job_id
    JOIN companies c  ON c.id = j.company_id
    LEFT JOIN profiles p ON p.user_id = ${userId}::uuid
    WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
  `;
  const src = rows[0] as
    | {
        resume_json: unknown; resume_trace_id: string | null;
        title: string; company_name: string; description: string | null;
        resume_text: string | null; model_resume: string | null;
      }
    | undefined;
  if (!src) throw new Error(`no résumé generated for job ${jobId}`);

  const scoredAt = new Date().toISOString();
  await sql`
    INSERT INTO resume_scores (
      user_id, job_id, grounding, jd_relevance, comment,
      resume_trace_id, resume_snapshot, model, scored_at
    ) VALUES (
      ${userId}::uuid, ${jobId}, ${row.grounding}, ${row.jd_relevance}, ${row.comment},
      ${src.resume_trace_id}, ${sql.json((src.resume_json ?? {}) as object)}, ${src.model_resume}, now()
    )
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      grounding = EXCLUDED.grounding, jd_relevance = EXCLUDED.jd_relevance,
      comment = EXCLUDED.comment, resume_trace_id = EXCLUDED.resume_trace_id,
      resume_snapshot = EXCLUDED.resume_snapshot, model = EXCLUDED.model,
      scored_at = now()
  `;

  let langfuseSynced = true;
  try {
    await upsertResumeGoldenItem(
      buildResumeGoldenItem({
        userId, jobId,
        input: {
          title: src.title, company: src.company_name, description: src.description,
          background: src.resume_text, model: src.model_resume,
        },
        form, traceId: src.resume_trace_id, model: src.model_resume, scoredAt,
      }),
    );
  } catch (e) {
    console.error("resume-golden dataset upsert failed", e);
    langfuseSynced = false;
  }

  revalidatePath("/");
  return { ok: true, langfuseSynced };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd dashboard && npx vitest run lib/resumeScore.action.test.ts`
Expected: all 3 PASS. If the mock `sql.json` isn't found, confirm the `@/lib/db` mock exposes `json` (the mock above attaches it via `Object.assign`).

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/actions/resumeScores.ts dashboard/lib/resumeScore.action.test.ts
git commit -m "feat(evals): saveResumeScore server action (DB-first, best-effort golden push)"
```

---

### Task 9: In-board scoring panel

**Files:**
- Create: `dashboard/components/rolefit/ResumeScorePanel.tsx`
- Modify: `dashboard/components/rolefit/ResumePanel.tsx`

**Interfaces:**
- Consumes: `saveResumeScore` (Task 8), `resumeChecks` (Task 3 — recomputed client-side from the résumé, so no prop-threading), `ResumeScoreForm`.
- Produces: `<ResumeScorePanel job={JobRow} resume={TailoredResume} isAuthed={boolean} />`.

- [ ] **Step 1: Create the scoring panel**

Create `dashboard/components/rolefit/ResumeScorePanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";
import { resumeOverall } from "@/lib/rolefit/resumeScore";
import { saveResumeScore } from "@/app/actions/resumeScores";

export interface ResumeScorePanelProps {
  job: JobRow;
  resume: TailoredResume;
  isAuthed: boolean;
}

const DIMS = [1, 2, 3, 4, 5];

export function ResumeScorePanel({ job, resume, isAuthed }: ResumeScorePanelProps) {
  const [open, setOpen] = useState(false);
  const [grounding, setGrounding] = useState<number | null>(null);
  const [jd, setJd] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(null);
  const [saving, setSaving] = useState(false);

  if (!isAuthed) return null;

  // Résumé-only mechanical checks (no ParsedProfile client-side).
  const { checks } = resumeChecks(resume);
  const canSave = grounding !== null && jd !== null && !saving;

  const onSave = async () => {
    if (grounding === null || jd === null) return;
    setSaving(true); setStatus(null);
    try {
      const form = { grounding, jdRelevance: jd, comment: comment.trim() || null };
      const res = await saveResumeScore(job.id, form);
      setStatus({
        ok: res.langfuseSynced,
        text: res.langfuseSynced ? "Score saved." : "Saved. LangFuse sync failed — will reconcile.",
      });
    } catch {
      setStatus({ ok: false, text: "Save failed — try again." });
    } finally {
      setSaving(false);
    }
  };

  const scale = (value: number | null, set: (n: number) => void, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
      <span style={{ width: "150px", fontSize: "12.5px", fontWeight: 700, color: "#3b4250" }}>{label}</span>
      {DIMS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => set(n)}
          style={{
            width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer",
            fontWeight: 700, fontSize: "13px",
            border: value === n ? "2px solid #3b6fd4" : "1px solid #dfe3ea",
            background: value === n ? "#eef3fc" : "#fff",
            color: value === n ? "#2b52a0" : "#5b6472",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: "13px", borderTop: "1px dashed #d8dee8", paddingTop: "13px" }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            fontWeight: 700, fontSize: "12.5px", color: "#5b6472", background: "#fff",
            border: "1px solid #dfe3ea", borderRadius: "9px", padding: "8px 13px", cursor: "pointer",
          }}
        >
          ★ Score résumé
        </button>
      ) : (
        <div>
          <div style={{ fontWeight: 800, fontSize: "13px", color: "#1b2330" }}>
            Score this résumé (1–5)
          </div>

          {/* Mechanical checks — guide the human score. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
            {checks.map((c) => (
              <span
                key={c.id}
                title={c.detail ?? c.label}
                style={{
                  fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "3px 8px",
                  color: c.pass ? "#2f7d54" : "#b25a36",
                  background: c.pass ? "#e6f4ec" : "#fdf0ec",
                  border: `1px solid ${c.pass ? "#c7e6d3" : "#f3d5c9"}`,
                }}
              >
                {c.pass ? "✓" : "✕"} {c.label}
              </span>
            ))}
          </div>

          {scale(grounding, setGrounding, "Grounding (truthful)")}
          {scale(jd, setJd, "JD relevance")}
          {grounding !== null && jd !== null && (
            <div style={{ fontSize: "12px", color: "#6b7480", marginTop: "8px", fontWeight: 600 }}>
              Overall: {resumeOverall(grounding, jd)} (grounding-weighted 0.7/0.3)
            </div>
          )}

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (optional)…"
            rows={2}
            style={{
              width: "100%", marginTop: "9px", padding: "8px 10px", fontSize: "12.5px",
              border: "1px solid #dfe3ea", borderRadius: "9px", resize: "vertical", boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: "9px", marginTop: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              style={{
                fontWeight: 700, fontSize: "13px", color: "#fff",
                background: canSave ? "#3b6fd4" : "#9db6e2", border: "none", borderRadius: "9px",
                padding: "9px 16px", cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Saving…" : "Save score"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setStatus(null); }}
              style={{
                fontWeight: 700, fontSize: "13px", color: "#5b6472", background: "#fff",
                border: "1px solid #dfe3ea", borderRadius: "9px", padding: "9px 14px", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            {status && (
              <span style={{ fontSize: "12px", fontWeight: 600, color: status.ok ? "#2f7d54" : "#b25a36" }}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `ResumePanel.tsx`'s Done block**

In `dashboard/components/rolefit/ResumePanel.tsx`:
1. Add import (top):
```ts
import { ResumeScorePanel } from "@/components/rolefit/ResumeScorePanel";
```
2. In the `{isDone && data && (...)}` block, immediately after the closing `</div>` of the action-buttons row (the div containing Download/Copy/Regenerate, which ends just before the block's outer close), add:
```tsx
          <ResumeScorePanel job={job} resume={data} isAuthed={isAuthed} />
```
   Place it as the last child inside the `<div style={{ padding: "17px 19px", background: "#f6faf7" }}>` Done wrapper.

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual smoke (optional but recommended)**

If `.env.local` has `NEXT_PUBLIC_SUPABASE_*` + `OPENROUTER_API_KEY`: `npm run dev`, sign in, open a job, Generate résumé, confirm the "★ Score résumé" button appears in the Done card, expands to two 1–5 rows + mechanical-check chips + comment + Save.

- [ ] **Step 5: Commit**

```bash
git add dashboard/components/rolefit/ResumeScorePanel.tsx dashboard/components/rolefit/ResumePanel.tsx
git commit -m "feat(evals): in-board résumé scoring panel"
```

---

### Task 10: Calibration + backfill script

**Files:**
- Create: `dashboard/scripts/calibrate-resume-judge.ts`

**Interfaces:**
- Consumes: `sql` (`@/lib/db`), `LangfuseClient` (`@langfuse/client`), `upsertResumeGoldenItem` + `buildResumeGoldenItem`, the judge score names from `resumeJudgeRubric.ts`.
- Produces: a CLI — default = calibration report (human-vs-judge agreement); `--sync` = re-push every `resume_scores` row to the golden dataset.

- [ ] **Step 1: Implement the script**

Create `dashboard/scripts/calibrate-resume-judge.ts`:

```ts
// Résumé judge calibration + golden-dataset backfill.
//   node --experimental-strip-types scripts/calibrate-resume-judge.ts          → calibration report
//   node --experimental-strip-types scripts/calibrate-resume-judge.ts --sync   → re-push resume_scores → resume-golden
// Requires LANGFUSE_* (+ DATABASE_URL) in the environment (.env.local).
import { LangfuseClient } from "@langfuse/client";
import { sql } from "@/lib/db";
import { buildResumeGoldenItem } from "@/lib/rolefit/resumeScore";
import { upsertResumeGoldenItem } from "@/lib/resumeGoldenDataset";
import {
  RESUME_JUDGE_GROUNDING_SCORE_NAME,
  RESUME_JUDGE_JD_RELEVANCE_SCORE_NAME,
} from "@/lib/rolefit/resumeJudgeRubric";

interface ScoreRow {
  user_id: string; job_id: string; grounding: number; jd_relevance: number;
  comment: string | null; resume_trace_id: string | null; model: string | null; scored_at: string;
  title: string; company_name: string; description: string | null; resume_text: string | null;
}

async function loadScores(): Promise<ScoreRow[]> {
  return (await sql`
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
    baseUrl: process.env.LANGFUSE_HOST,
  });
}

// Read the managed judge's scores off a trace. `api.trace.get` returns the trace
// with its `scores` array; each score has a `name` + numeric `value`. If the SDK
// shape differs, adjust the accessor — the concept (name→value on the trace) holds.
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
  await sql.end({ timeout: 5 });
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Typecheck the script**

Run: `cd dashboard && npx tsc --noEmit`
Expected: clean. (`api.trace.get` is loosely cast; if `tsc` complains about `c.api.trace`, cast `c.api as any` at that call and leave the `// verify SDK shape` note.)

- [ ] **Step 3: Sanity-run `--sync` against an empty DB (no crash)**

With `LANGFUSE_*` unset, `--sync` should upsert 0 items (the helper no-ops) and print `synced 0 …`:

```bash
cd dashboard && node --experimental-strip-types scripts/calibrate-resume-judge.ts --sync
```
Expected: `synced 0 resume_scores → resume-golden` (or the count of existing rows), no crash. If it can't reach the DB, that's an env issue (needs `DATABASE_URL`), not a script bug.

- [ ] **Step 4: Commit**

```bash
git add dashboard/scripts/calibrate-resume-judge.ts
git commit -m "feat(evals): résumé judge calibration + golden backfill script"
```

---

### Task 11: Configure the managed evaluator (LangFuse UI) + full-run docs

**Files:**
- Create: `docs/superpowers/plans/2026-07-02-resume-evals-langfuse-setup.md` (operator runbook — no app code)

**This task is manual configuration + documentation; it produces no compiled code.**

- [ ] **Step 1: Write the runbook**

Create `docs/superpowers/plans/2026-07-02-resume-evals-langfuse-setup.md` documenting:
1. **Managed evaluator** — in the LangFuse UI (US region, project `cmqvp2hg103h8ad0cjibfrrhw`), create an LLM-as-judge evaluator:
   - Prompt = the contents of `dashboard/lib/rolefit/resumeJudgeRubric.ts` (`RESUME_JUDGE_RUBRIC`).
   - Model = **Claude Sonnet 5** (add the LLM connection; confirm the exact model slug against the current model list).
   - Output → two scores named exactly `grounding` and `jd_relevance` (must match `RESUME_JUDGE_*_SCORE_NAME`).
   - Target: traces whose observation name is `resume`; map `{{job_title}}`/`{{job_company}}`/`{{job_description}}` from the trace input and `{{resume}}` from the trace output.
   - **Enable on both live traces AND dataset runs** (unlocks the deferred regression harness).
   - Sampling: 100% (low volume).
2. **Env** — confirm `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` on the Vercel project (Production + Preview).
3. **Deploy order** — apply `migrations/2026-07-02-resume-scores.sql` to Supabase, then push (push-to-main auto-deploys the dashboard on Vercel; no reviewer/Railway change).
4. **End-to-end verification** — generate a résumé → confirm a `resume` trace in LangFuse (US region) with `grounding`/`jd_relevance` scores and `mechanical_checks` metadata → score it in the board → confirm a `resume-golden` dataset item with the human `expectedOutput` → run `node --experimental-strip-types scripts/calibrate-resume-judge.ts` and confirm the agreement report joins the two.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-02-resume-evals-langfuse-setup.md
git commit -m "docs(evals): LangFuse managed-evaluator setup + end-to-end runbook"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- Component 1 (traces evaluator-ready: parent obs, trace-id, managed evaluator, sampling) → Tasks 5, 7, 11. ✓
- Component 2 (scoring UI + `saveResumeScore`) → Tasks 8, 9. ✓
- Component 3 (data model: `resume_scores` + `application_packages.resume_trace_id`) → Task 1. ✓
- Component 4 (dataset helper + calibration/backfill) → Tasks 6, 10. ✓
- Component 5 (mechanical checks, computed in `generateResume`, trace + UI) → Tasks 3, 7 (trace attach), 9 (UI display). ✓
- Regression plumbing (golden `input` carries full generation inputs; evaluator on dataset runs; `model` in metadata; `generateResume` script-callable) → Tasks 4 (input + model in metadata), 11 (dataset-run evaluator), 7 (generateResume shape). ✓
- Rubric = grounding + jd_relevance, overall 0.7/0.3, judge = Claude Sonnet 5 → Tasks 4, 5, 11. ✓
- Testing (vitest for checks, score builder, dataset payload, action; manual live pass) → Tasks 2–4, 6, 8, 11. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The two loosely-typed LangFuse SDK calls (`api.trace.get`, `startActiveObservation` output shape) carry an explicit verified-accessor note with concrete fallbacks, matching the reviewer spec's accepted SDK-caveat convention — not placeholders.

**Type consistency:** `ResumeScoreForm { grounding, jdRelevance, comment }` used identically in Tasks 4/8/9. `resumeOverall(g, jd)` returns a 1-decimal number, asserted as `4.7`/`3.7`/`3.8` in Tasks 4/8. `resumeChecks(resume, parsed?)` — `parsed` optional; client calls `resumeChecks(resume)` (Task 9), server calls `resumeChecks(resume, profile)` (Task 7). `generateResume` returns `{ resume, checks }` everywhere (Tasks 7 callers). Golden item `{ id, datasetName, input, expectedOutput, metadata }` consistent across Tasks 4/6/10. Score names `grounding`/`jd_relevance` shared by Tasks 5/10/11.

---

## Execution Handoff

Fill this in after the user picks an execution mode.
