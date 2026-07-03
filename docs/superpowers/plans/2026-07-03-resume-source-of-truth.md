# Résumé Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `profiles.resume_text` the single source of truth for résumé generation — uploads extract into it as reviewable markdown, generation parses text only, the stored file is archival — and repair two adjacent profile-data bugs (`links` double-encoding, `full_name`/`location` scramble).

**Architecture:** Generation stops reading the uploaded PDF entirely and parses `resume_text` (which already understands markdown as of `fe54af1`). Uploads are converted to complete markdown at upload time by reusing the coordinate PDF parser plus a new serializer, dropped into the editable résumé box for review, and committed on save. The uploaded file is kept only as an archival artifact. The competing-source machinery (`resolveResumeFilePath`, `parseProfile`'s PDF branch) is removed.

**Tech Stack:** Next.js 16 (App Router, server actions) + React 19, TypeScript, `postgres` (postgres.js) against Supabase Postgres, `unpdf` for PDF parsing, Vitest (node env for `lib/**`, jsdom for `*.test.tsx`), Supabase Storage (`resumes` bucket).

## Global Constraints

- Never `as`-cast a jsonb column across the DB boundary — read it through a **total parser** that unwraps + validates, returning a valid typed value or a safe default (see `dashboard/CLAUDE.md`, `lib/rolefit/packageCodec.ts`). No zod — hand-rolled parsers are the house style.
- Colocate a parser with the type it parses.
- TDD: every production change starts with a failing test you watch fail. DRY, YAGNI, frequent commits.
- Run the full suite with `./node_modules/.bin/vitest run` and a single file with `./node_modules/.bin/vitest run <path>` from `dashboard/` (do NOT use bare `npx vitest` — it can resolve the wrong vite; the local bin is correct). Typecheck with `./node_modules/.bin/tsc --noEmit`.
- If `dashboard/node_modules` is missing (fresh worktree), run `npm install` in `dashboard/` first.
- Pure `lib/rolefit/parseProfile.ts` helpers must not import `unpdf` functions at call sites that the client bundle reaches — keep new pure helpers importing only types where the existing file already does.
- Data-repair tasks run against Supabase project `fdhspmavadgucktetzoi` via the Supabase MCP (`execute_sql`), owner user `9ae8b777-7c24-4290-8aad-bd2b10eff23b`. Read the row and confirm before writing.

---

## Part A — `links` double-encoding fix

Independent of Parts B/C. `getProfile` (`lib/queries.ts:214`) returns `rows[0] as unknown as ProfileRow`, so `links` (jsonb) is never validated; when it comes back as a double-encoded string scalar, the board résumé-modal save (`app/actions/profile.ts`) re-`JSON.stringify`s it, compounding the escaping.

### Task A1: Total parser for `ProfileLinks`, applied at the `getProfile` boundary

**Files:**
- Create: `dashboard/lib/profileLinks.ts`
- Test: `dashboard/lib/profileLinks.test.ts`
- Modify: `dashboard/lib/queries.ts` (`getProfile`, ~211-215)

**Interfaces:**
- Consumes: `ProfileLinks` from `@/lib/types` (`{ linkedin?: string|null; github?: string|null; portfolio?: string|null }`).
- Produces: `parseProfileLinks(raw: unknown): ProfileLinks` — always returns a plain object with only the three known keys (string or omitted); tolerates up to a few layers of accidental JSON-string-encoding; never throws.

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/profileLinks.test.ts
import { describe, expect, test } from "vitest";
import { parseProfileLinks } from "@/lib/profileLinks";

describe("parseProfileLinks", () => {
  const obj = { linkedin: "https://linkedin.com/in/x", github: "https://github.com/x", portfolio: "https://x.com" };

  test("passes a clean object through, keeping only known keys", () => {
    expect(parseProfileLinks({ ...obj, junk: "drop me" })).toEqual(obj);
  });

  test("unwraps a single-encoded JSON string", () => {
    expect(parseProfileLinks(JSON.stringify(obj))).toEqual(obj);
  });

  test("unwraps a triple-encoded JSON string (the prod corruption)", () => {
    let v: string = JSON.stringify(obj);
    v = JSON.stringify(v);
    v = JSON.stringify(v);
    expect(parseProfileLinks(v)).toEqual(obj);
  });

  test("coerces missing/blank fields and null input to an empty object", () => {
    expect(parseProfileLinks(null)).toEqual({});
    expect(parseProfileLinks(undefined)).toEqual({});
    expect(parseProfileLinks("not json")).toEqual({});
    expect(parseProfileLinks({ linkedin: "  ", github: 42 })).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run lib/profileLinks.test.ts`
Expected: FAIL — cannot resolve `@/lib/profileLinks` / `parseProfileLinks` is not a function.

- [ ] **Step 3: Write minimal implementation**

```typescript
// dashboard/lib/profileLinks.ts
import type { ProfileLinks } from "@/lib/types";

// Total parser for the profiles.links jsonb column. postgres.js can return a
// double-encoded jsonb value as a JS *string* (see dashboard/CLAUDE.md); a prior
// bug re-stringified it on each save, nesting the escaping several deep. Unwrap
// up to a few string layers, then keep ONLY the three known URL keys as non-empty
// strings. Any malformed shape degrades to {} rather than throwing into a render.
const MAX_UNWRAP = 5;

function trimmedString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function parseProfileLinks(raw: unknown): ProfileLinks {
  let cur = raw;
  for (let i = 0; i < MAX_UNWRAP && typeof cur === "string"; i++) {
    try {
      cur = JSON.parse(cur);
    } catch {
      return {};
    }
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return {};
  const src = cur as Record<string, unknown>;
  const out: ProfileLinks = {};
  const linkedin = trimmedString(src.linkedin);
  const github = trimmedString(src.github);
  const portfolio = trimmedString(src.portfolio);
  if (linkedin) out.linkedin = linkedin;
  if (github) out.github = github;
  if (portfolio) out.portfolio = portfolio;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run lib/profileLinks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Apply the parser at the getProfile boundary**

In `dashboard/lib/queries.ts`, add the import near the other `@/lib/...` imports:

```typescript
import { parseProfileLinks } from "@/lib/profileLinks";
```

Replace `getProfile` (lines ~211-215):

```typescript
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  // ::uuid — postgres.js binds the JS string as text; the uuid column needs the cast.
  const rows = await sql`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`;
  const row = rows[0] as unknown as ProfileRow | undefined;
  if (!row) return null;
  // links is jsonb — never trust the raw read (it can arrive as a double-encoded
  // string scalar). Route it through the total parser so a corrupt value can't
  // propagate back into the write path or crash a render.
  return { ...row, links: parseProfileLinks((row as { links: unknown }).links) };
}
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `./node_modules/.bin/vitest run` then `./node_modules/.bin/tsc --noEmit`
Expected: all pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add dashboard/lib/profileLinks.ts dashboard/lib/profileLinks.test.ts dashboard/lib/queries.ts
git commit -m "fix(profile): parse links jsonb through a total parser at the read boundary

getProfile bare-cast the row, so a double-encoded links value (a jsonb string
scalar) flowed back into the résumé-modal save and got re-stringified each time,
nesting the escaping. Add parseProfileLinks (unwrap N string layers, keep only
known URL keys, degrade to {}) and apply it in getProfile."
```

### Task A2: Repair the corrupted `links` row in prod

**Files:** none (Supabase MCP `execute_sql`).

- [ ] **Step 1: Read the current value**

Run (Supabase MCP `execute_sql`, project `fdhspmavadgucktetzoi`):
```sql
select links from profiles where user_id = '9ae8b777-7c24-4290-8aad-bd2b10eff23b';
```
Expected: a deeply-escaped string containing linkedin/github/portfolio URLs.

- [ ] **Step 2: Overwrite with the decoded object**

```sql
update profiles
set links = '{"linkedin":"https://linkedin.com/in/andrewmalvani","github":"https://github.com/manwithaplandy","portfolio":"https://andrewmalvani.com"}'::jsonb
where user_id = '9ae8b777-7c24-4290-8aad-bd2b10eff23b'
returning jsonb_typeof(links) as type, links;
```
Expected: `type` = `object`, `links` = the clean object.

- [ ] **Step 3: Verify the read path returns a clean object** (after Task A1 is deployed, or via a local `parseProfileLinks` check) — the board profile modal save no longer re-nests it.

---

## Part B — `full_name` / `location` scramble repair

Independent of Parts A/C. Prod has `full_name="Andrew"`, `location="Malvani"` (name split across the two fields; `location` should be a city).

### Task B1: Repair the row + audit the save path

**Files:** none for the repair; read-only audit of `dashboard/app/profile/page.tsx` + `dashboard/app/actions/profile.ts`.

- [ ] **Step 1: Confirm the target values with the user** — `full_name = "Andrew Malvani"`, `location = "Phoenix, AZ"` (city taken from the résumé contact line). Do not proceed until confirmed.

- [ ] **Step 2: Repair the row** (Supabase MCP `execute_sql`)

```sql
update profiles
set full_name = 'Andrew Malvani', location = 'Phoenix, AZ'
where user_id = '9ae8b777-7c24-4290-8aad-bd2b10eff23b'
returning full_name, location;
```

- [ ] **Step 3: Audit** — confirm `saveProfile` (`app/profile/page.tsx`) and `saveProfileResume` (`app/actions/profile.ts`) read `full_name` and `location` from their own distinct form fields (`formData.get("full_name")`, `formData.get("location")`) with no code path that splits a name across them. Expected: they are independent fields → the scramble was a one-time data-entry/import artifact, no code change needed. If a splitting code path is found, stop and report it (out of scope for a silent fix).

---

## Part C — `resume_text` as the single source of truth

Depends on the shipped markdown parser (`fe54af1`). Parts C1→C5 are ordered.

### Task C1: Surface un-consumed prose sections from the PDF parse

**Files:**
- Modify: `dashboard/lib/rolefit/parseProfile.ts`
- Test: `dashboard/lib/rolefit/parseProfile.test.ts`

**Interfaces:**
- Consumes: existing `parsePdfItems(items: PdfItem[]): ParsedProfile`, and the module-internal `buildLines`, `isHeadingLine` helpers.
- Produces: `export interface ProseSection { heading: string; lines: string[] }` and `export function parsePdfItemsWithProse(items: PdfItem[]): { profile: ParsedProfile; prose: ProseSection[] }` — `prose` holds sections whose heading is NOT experience/education/certifications (e.g. Summary, Skills, Projects), each with its body lines in document order.

- [ ] **Step 1: Write the failing test**

```typescript
// append to dashboard/lib/rolefit/parseProfile.test.ts
import { parsePdfItemsWithProse } from "@/lib/rolefit/parseProfile";

describe("parsePdfItemsWithProse — prose capture", () => {
  // Minimal single-column PdfItem set: name, a SUMMARY heading + body, and an
  // EXPERIENCE heading (structured, must NOT appear in prose). y descends down
  // the page; x constant; one font.
  const line = (str: string, y: number): PdfItem => ({ str, x: 72, y, size: 11, font: "F0", width: str.length * 5 });
  const items: PdfItem[] = [
    line("Jordan Casey", 720),
    line("jordan@example.com", 705),
    line("Summary", 680),
    line("Seasoned engineer with a decade in AI infrastructure.", 665),
    line("Experience", 640),
    line("January 2020 - Present", 625),
    line("Acme Corp", 610),
    line("Staff Engineer", 595),
    line("● Shipped the platform", 580),
  ];

  test("captures the Summary section as prose, excludes Experience", () => {
    const { prose } = parsePdfItemsWithProse(items);
    const summary = prose.find((p) => /summary/i.test(p.heading));
    expect(summary?.lines.join(" ")).toContain("Seasoned engineer");
    expect(prose.some((p) => /experience/i.test(p.heading))).toBe(false);
  });

  test("still returns the structured profile unchanged", () => {
    const { profile } = parsePdfItemsWithProse(items);
    expect(profile.name).toBe("Jordan Casey");
    expect(profile.experience[0].company).toBe("Acme Corp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run lib/rolefit/parseProfile.test.ts -t "prose capture"`
Expected: FAIL — `parsePdfItemsWithProse` is not exported.

- [ ] **Step 3: Implement in `parseProfile.ts`** (add after `parsePdfItems`)

```typescript
export interface ProseSection {
  heading: string;
  lines: string[];
}

/** Headings whose bodies are already captured as structured fields. */
const STRUCTURED_HEADING_RE = /experience|employment|work history|education|academ|cert/i;

/**
 * parsePdfItems + the leftover "prose" sections (Summary, Skills, Projects, …)
 * that the structured parse discards. Used only by the upload→markdown serializer
 * so nothing on the page is lost; generation still consumes `profile`.
 */
export function parsePdfItemsWithProse(items: PdfItem[]): { profile: ParsedProfile; prose: ProseSection[] } {
  const profile = parsePdfItems(items);
  const clean = items.filter((i) => i.str && i.str.trim() !== "");
  const lines = buildLines(clean);
  const headingLines = lines.filter((l) => isHeadingLine(l.text));
  const prose: ProseSection[] = [];
  for (const h of headingLines) {
    if (STRUCTURED_HEADING_RE.test(h.text)) continue;
    const below = headingLines.filter((x) => x.y < h.y).map((x) => x.y);
    const endY = below.length ? Math.max(...below) : -Infinity;
    const body = lines.filter((l) => l.y < h.y && l.y > endY).map((l) => l.text.trim()).filter(Boolean);
    if (body.length) prose.push({ heading: h.text.trim(), lines: body });
  }
  return { profile, prose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run lib/rolefit/parseProfile.test.ts -t "prose capture"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole parseProfile suite (no regression)**

Run: `./node_modules/.bin/vitest run lib/rolefit/parseProfile.test.ts`
Expected: all pass, 1 skipped (binary smoke).

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/rolefit/parseProfile.ts dashboard/lib/rolefit/parseProfile.test.ts
git commit -m "feat(rolefit): surface un-consumed prose sections from the PDF parse

parsePdfItemsWithProse returns the structured ParsedProfile plus the Summary/
Skills/etc. sections the structured parse drops, so the upload→markdown
serializer can preserve them as LLM context."
```

### Task C2: `serializeProfileToMarkdown`

**Files:**
- Create: `dashboard/lib/rolefit/serializeProfileToMarkdown.ts`
- Test: `dashboard/lib/rolefit/serializeProfileToMarkdown.test.ts`

**Interfaces:**
- Consumes: `ParsedProfile`, `ProseSection` from `@/lib/rolefit/parseProfile`; `parseProfileText` for the round-trip test.
- Produces: `serializeProfileToMarkdown(profile: ParsedProfile, prose?: ProseSection[]): string` — emits the markdown dialect `parseProfileText` parses (`# Name`, contact, `## <prose headings>`, `## Experience` → `### Company` / `#### Role · dates`, bullets, `## Education`, `## Certifications`).

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/serializeProfileToMarkdown.test.ts
import { describe, expect, test } from "vitest";
import { serializeProfileToMarkdown } from "@/lib/rolefit/serializeProfileToMarkdown";
import { parseProfileText, type ParsedProfile } from "@/lib/rolefit/parseProfile";

const profile: ParsedProfile = {
  name: "Jordan Casey",
  contact: "jordan@example.com | 555-0134 | Phoenix, AZ | linkedin.com/in/jordan",
  educationEntries: ["M.S., Computer Science — State University · 2020"],
  certifications: ["AWS Certified: Solutions Architect"],
  experience: [
    { role: "Staff Engineer", company: "Acme Corp", dates: "January 2020 – Present", sourceBullets: ["Shipped the platform", "Led the team"] },
    { role: "Engineer", company: "Globex", dates: "June 2017 – January 2020", sourceBullets: ["Built the API"] },
  ],
};

describe("serializeProfileToMarkdown", () => {
  test("round-trips structured fields through parseProfileText", () => {
    const md = serializeProfileToMarkdown(profile, [{ heading: "Summary", lines: ["Seasoned engineer."] }]);
    const reparsed = parseProfileText(md);
    expect(reparsed.name).toBe("Jordan Casey");
    expect(reparsed.contact).toContain("Phoenix, AZ");
    expect(reparsed.experience.map((r) => ({ role: r.role, company: r.company }))).toEqual([
      { role: "Staff Engineer", company: "Acme Corp" },
      { role: "Engineer", company: "Globex" },
    ]);
    expect(reparsed.experience[0].sourceBullets).toEqual(["Shipped the platform", "Led the team"]);
    expect(reparsed.educationEntries).toEqual(["M.S., Computer Science — State University · 2020"]);
    expect(reparsed.certifications).toEqual(["AWS Certified: Solutions Architect"]);
  });

  test("preserves prose sections as markdown headings", () => {
    const md = serializeProfileToMarkdown(profile, [{ heading: "Summary", lines: ["Seasoned engineer."] }]);
    expect(md).toContain("## Summary");
    expect(md).toContain("Seasoned engineer.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run lib/rolefit/serializeProfileToMarkdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
// dashboard/lib/rolefit/serializeProfileToMarkdown.ts
// RUNTIME-PURE: imports only types + parseProfile types. Emits the markdown
// dialect parseProfileText parses, so an uploaded file round-trips to the same
// ParsedProfile the generator would build, while prose (Summary/Skills) survives
// as LLM context.
import type { ParsedProfile, ProseSection } from "@/lib/rolefit/parseProfile";

export function serializeProfileToMarkdown(profile: ParsedProfile, prose: ProseSection[] = []): string {
  const out: string[] = [];
  if (profile.name) out.push(`# ${profile.name}`, "");
  if (profile.contact) out.push(profile.contact, "");

  for (const section of prose) {
    if (!section.heading || !section.lines.length) continue;
    out.push(`## ${section.heading}`, "");
    for (const l of section.lines) out.push(l);
    out.push("");
  }

  if (profile.experience.length) {
    out.push("## Experience", "");
    for (const r of profile.experience) {
      if (r.company) out.push(`### ${r.company}`, "");
      const roleLine = [r.role, r.dates].filter(Boolean).join(" · ");
      if (roleLine) out.push(`#### ${roleLine}`, "");
      for (const b of r.sourceBullets) out.push(`- ${b}`);
      out.push("");
    }
  }

  if (profile.educationEntries.length) {
    out.push("## Education", "");
    for (const e of profile.educationEntries) out.push(`- ${e}`);
    out.push("");
  }

  if (profile.certifications.length) {
    out.push("## Certifications", "");
    for (const c of profile.certifications) out.push(`- ${c}`);
    out.push("");
  }

  return out.join("\n").trim() + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run lib/rolefit/serializeProfileToMarkdown.test.ts`
Expected: PASS (2 tests). If the round-trip drops a field, adjust the emitted markdown to match `parseProfileText`'s expectations (do not weaken the test).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/serializeProfileToMarkdown.ts dashboard/lib/rolefit/serializeProfileToMarkdown.test.ts
git commit -m "feat(rolefit): serialize a ParsedProfile (+ prose) to review-ready markdown"
```

### Task C3: `fileToResumeMarkdown` extractor seam

**Files:**
- Create: `dashboard/lib/rolefit/fileToResumeMarkdown.ts`
- Test: `dashboard/lib/rolefit/fileToResumeMarkdown.test.ts`

**Interfaces:**
- Consumes: `extractPdfItems`, `parsePdfItemsWithProse` from `@/lib/rolefit/parseProfile`; `serializeProfileToMarkdown`; existing `extractPdfText` from `@/lib/pdf` (fallback).
- Produces: `type ResumeFileType = "pdf"` and `async function fileToResumeMarkdown(bytes: Uint8Array, type: ResumeFileType): Promise<string>` — returns review-ready markdown; falls back to flat extracted text when the structured parse yields nothing usable; `""` for empty input.

- [ ] **Step 1: Write the failing test**

```typescript
// dashboard/lib/rolefit/fileToResumeMarkdown.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { parseProfileText } from "@/lib/rolefit/parseProfile";

const here = path.dirname(fileURLToPath(import.meta.url));
const realPdf = path.resolve(here, "../../scripts/fixtures/source.pdf");

describe("fileToResumeMarkdown", () => {
  test("returns empty string for empty input", async () => {
    expect(await fileToResumeMarkdown(new Uint8Array(), "pdf")).toBe("");
  });

  test.skipIf(!existsSync(realPdf))("converts the real PDF to parseable markdown", async () => {
    const md = await fileToResumeMarkdown(new Uint8Array(readFileSync(realPdf)), "pdf");
    expect(md.length).toBeGreaterThan(0);
    const profile = parseProfileText(md);
    expect(profile.name.length).toBeGreaterThan(0);
    expect(profile.experience.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/vitest run lib/rolefit/fileToResumeMarkdown.test.ts`
Expected: FAIL — module not found (the binary test is skipped in a worktree without the gitignored fixture; the empty-input test drives the failure).

- [ ] **Step 3: Implement**

```typescript
// dashboard/lib/rolefit/fileToResumeMarkdown.ts
// Convert an uploaded résumé file into review-ready markdown that becomes the
// editable source of truth. PDF reuses the coordinate parser + serializer; if
// that yields no usable structure, fall back to flat extracted text so nothing
// is lost. New file types plug in here.
import { extractPdfItems, parsePdfItemsWithProse } from "@/lib/rolefit/parseProfile";
import { serializeProfileToMarkdown } from "@/lib/rolefit/serializeProfileToMarkdown";
import { extractPdfText } from "@/lib/pdf";

export type ResumeFileType = "pdf";

export async function fileToResumeMarkdown(bytes: Uint8Array, type: ResumeFileType): Promise<string> {
  if (bytes.length === 0) return "";
  if (type === "pdf") {
    const { profile, prose } = parsePdfItemsWithProse(await extractPdfItems(bytes));
    if (profile.name && profile.experience.length > 0) {
      return serializeProfileToMarkdown(profile, prose);
    }
    // Structured parse failed — preserve the raw text for the user to fix.
    return await extractPdfText(bytes);
  }
  return "";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run lib/rolefit/fileToResumeMarkdown.test.ts`
Expected: PASS (empty-input test; binary test PASS if the fixture is present, else skipped).

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/rolefit/fileToResumeMarkdown.ts dashboard/lib/rolefit/fileToResumeMarkdown.test.ts
git commit -m "feat(rolefit): fileToResumeMarkdown seam (PDF → review-ready markdown)"
```

### Task C4: Generation reads text only

**Files:**
- Modify: `dashboard/lib/rolefit/resumeSource.ts`
- Modify: `dashboard/lib/rolefit/resumeClient.ts`
- Modify: `dashboard/app/api/resume/route.ts`
- Modify: `dashboard/app/api/application/prepare/route.ts`
- Test: `dashboard/lib/rolefit/resumeClient.test.ts` (existing — adjust)

**Interfaces:**
- Produces: `getResumeSource(profile) → Promise<{ resumeText: string }>` (no `pdfBytes`). `generateResume` drops the `pdfBytes` argument and parses `resumeText` via `parseProfileText`.

- [ ] **Step 1: Simplify `getResumeSource`** — replace the file body of `dashboard/lib/rolefit/resumeSource.ts` with:

```typescript
import type { ProfileRow } from "@/lib/types";

// resume_text is the single source of truth for generation. The uploaded file is
// archival only (converted to markdown at upload time), so generation never
// downloads or re-parses it. Callers must have confirmed profile.resume_text.
export function getResumeSource(profile: Pick<ProfileRow, "resume_text">): { resumeText: string } {
  return { resumeText: profile.resume_text ?? "" };
}
```

- [ ] **Step 2: Update `generateResume`** in `dashboard/lib/rolefit/resumeClient.ts` — remove `pdfBytes` from the args and use the text parser:

```typescript
import { parseProfileText } from "@/lib/rolefit/parseProfile";
// ...
export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ resume: TailoredResume; checks: ResumeChecks }> {
  const profile = parseProfileText(args.resumeText);
  const tenureYears = yearsOfExperience(profile, Date.now());
  const { system, user } = buildResumePrompt({ profile, resumeText: args.resumeText, job: args.job, tenureYears });
  // ...unchanged callOpenRouterStructured(...) and return...
}
```
Remove the now-unused `parseProfile` import (keep `parseProfileText`, `yearsOfExperience`).

- [ ] **Step 3: Update both routes** — in `app/api/resume/route.ts` and `app/api/application/prepare/route.ts`, change `const { resumeText, pdfBytes } = await getResumeSource(profile);` to `const { resumeText } = getResumeSource(profile);` and delete `pdfBytes` from the `generateResume({...})` call args.

- [ ] **Step 4: Update the existing resumeClient test** — in `dashboard/lib/rolefit/resumeClient.test.ts`, remove any `pdfBytes` argument passed to `generateResume` (generation is text-only now). Keep the behavior assertions.

- [ ] **Step 5: Run the affected suites + typecheck**

Run: `./node_modules/.bin/vitest run lib/rolefit/resumeClient.test.ts` then `./node_modules/.bin/tsc --noEmit`
Expected: PASS; tsc clean (surfaces any missed `pdfBytes` reference).

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/rolefit/resumeSource.ts dashboard/lib/rolefit/resumeClient.ts dashboard/app/api/resume/route.ts dashboard/app/api/application/prepare/route.ts dashboard/lib/rolefit/resumeClient.test.ts
git commit -m "refactor(rolefit): generate résumés from resume_text only (drop the PDF source)"
```

### Task C5: Upload extracts to the review box; drop `resolveResumeFilePath`

**Files:**
- Create: `dashboard/app/api/resume/extract/route.ts`
- Modify: `dashboard/app/actions/profile.ts` (`saveProfileResume`)
- Modify: `dashboard/app/profile/page.tsx` (`saveProfile`)
- Modify: `dashboard/lib/paths.ts` (add the new route to `PUBLIC_PREFIXES` only if it must be reachable without the auth redirect — it is authed, so DO NOT add it)
- Delete: `dashboard/lib/resumeFilePath.ts` + `dashboard/lib/resumeFilePath.test.ts`
- Client: a small client component for the résumé file input that calls the extract route and fills the textarea (see Step 3).

**Interfaces:**
- Produces: `POST /api/resume/extract` — multipart body with `file`; returns `{ markdown: string }`. Auth-gated (returns 401 if signed out).

- [ ] **Step 1: Add the extract route**

```typescript
// dashboard/app/api/resume/extract/route.ts
import { getUserId } from "@/lib/auth";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "sign in to upload a résumé" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "no file provided" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const markdown = await fileToResumeMarkdown(bytes, "pdf");
  if (!markdown) return Response.json({ error: "could not read that file" }, { status: 422 });
  return Response.json({ markdown });
}
```

- [ ] **Step 2: Verify the route is NOT in the anon allowlist** — confirm `/api/resume/extract` is not matched by `PUBLIC_PREFIXES` in `dashboard/lib/paths.ts` (it requires auth). No change expected; just verify.

- [ ] **Step 3: Client file-input component that fills the textarea**

Create a client component that renders the résumé file `<input type="file">`, and on change POSTs to `/api/resume/extract`, then writes `{markdown}` into the résumé textarea (by shared `id`/ref) so the user reviews it before saving. Keep it minimal and match the existing profile form styling. Example shape:

```typescript
"use client";
import { useState } from "react";

export function ResumeUploadField({ textareaId }: { textareaId: string }) {
  const [status, setStatus] = useState<string>("");
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Extracting…");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/resume/extract", { method: "POST", body });
    if (!res.ok) { setStatus("Couldn't read that file — paste your résumé text instead."); return; }
    const { markdown } = (await res.json()) as { markdown: string };
    const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (ta) { ta.value = markdown; ta.dispatchEvent(new Event("input", { bubbles: true })); }
    setStatus("Extracted — review the text below, then Save.");
  }
  return (
    <div>
      <input type="file" name="resume_pdf" accept="application/pdf" onChange={onChange} />
      {status && <p>{status}</p>}
    </div>
  );
}
```
Wire it into `app/profile/page.tsx` (and the board résumé modal `ProfileModal.tsx` if it exposes upload) so the file input is this component and the résumé textarea carries the matching `id`.

- [ ] **Step 4: Simplify the two save paths** — the file input still submits so the file is archived, but the save NO LONGER extracts text (the client already did) and NO LONGER calls `resolveResumeFilePath`.

In `app/actions/profile.ts` (`saveProfileResume`) and `app/profile/page.tsx` (`saveProfile`), replace the upload+resolve block with:

```typescript
    let resumeFilePath = existing?.resume_file_path ?? null;
    const file = formData.get("resume_pdf");
    if (file instanceof File && file.size > 0) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const path = `${userId}/${Date.now()}-${file.name}`;
      const supabase = await createClient();
      const { error } = await supabase.storage
        .from("resumes")
        .upload(path, bytes, { contentType: file.type || "application/pdf", upsert: true });
      if (error) throw new Error(`resume upload failed: ${error.message}`); // page.tsx: return { error: ... }
      resumeFilePath = path; // archival only — generation reads resume_text
    }
```
Remove the `import { resolveResumeFilePath } from "@/lib/resumeFilePath"` and the `import { extractPdfText } from "@/lib/pdf"` from these two files (the action no longer extracts). `resumeText` comes straight from `submittedText || existing?.resume_text || null`.

- [ ] **Step 5: Delete the dead resolver**

```bash
git rm dashboard/lib/resumeFilePath.ts dashboard/lib/resumeFilePath.test.ts
```

- [ ] **Step 6: Run full suite + typecheck**

Run: `./node_modules/.bin/vitest run` then `./node_modules/.bin/tsc --noEmit`
Expected: all pass; tsc clean (confirms no lingering `resolveResumeFilePath` / `pdfBytes` references).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(profile): upload extracts to the review box; resume_text is the source of truth

Uploading a résumé now POSTs to /api/resume/extract, converts it to markdown via
fileToResumeMarkdown, and fills the editable résumé box for review; save stores
that text and archives the file. Drops resolveResumeFilePath and the save-time
extraction — the file is no longer a competing parse source."
```

### Task C6: End-to-end verification

**Files:** none (manual/browser verification).

- [ ] **Step 1: Full suite + typecheck green**

Run: `./node_modules/.bin/vitest run` then `./node_modules/.bin/tsc --noEmit`
Expected: all pass, 1 skipped; tsc clean.

- [ ] **Step 2: Local smoke of the upload→review flow** — run `npm run dev` (needs `NEXT_PUBLIC_SUPABASE_*` + DB env, per the `dashboard-env-local-not-in-worktrees` memory; run from the main checkout if the worktree lacks env). Upload a PDF on `/profile`, confirm the textarea fills with structured markdown, edit a line, save, and confirm `resume_text` persisted the edited text and `resume_file_path` points at the new upload.

- [ ] **Step 3: Regenerate a résumé** and confirm the header shows the current city + full experience, generated from `resume_text` (no PDF read). Verify via the board or by inspecting the new `application_packages.resume_json.contact`.

---

## Self-Review

- **Spec coverage:** single-source-of-truth (C4), upload→markdown Option B with prose preservation (C1–C3, C5), review-before-commit UX (C5), archival file + drop resolver/PDF-preference (C4/C5), `links` fix (A1/A2), name/location repair (B1), extractor seam for future types (C3), testing (per-task + C6). ✓
- **Placeholder scan:** no TBD/TODO; all code steps carry complete code. The client component in C5 Step 3 is a concrete example to wire in, not a placeholder.
- **Type consistency:** `parsePdfItemsWithProse` → `{ profile, prose }` (C1) consumed by `fileToResumeMarkdown` (C3) and `serializeProfileToMarkdown(profile, prose)` (C2); `getResumeSource` returns `{ resumeText }` (C4) consumed by both routes; `ResumeFileType`/`fileToResumeMarkdown` used by the extract route (C5). Consistent.
- **Open item:** confirm the `location` value with the user (B1 Step 1) before running the repair.
