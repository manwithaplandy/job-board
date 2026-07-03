# Résumé source-of-truth redesign

**Date:** 2026-07-03
**Status:** Approved (design), pending implementation plan
**Related:** `resume-wrong-city-markdown-parse` memory; ships on top of the markdown-parser fix (`fe54af1`)

## Problem

Résumé generation has **two competing sources** for a candidate's background:

1. `profiles.resume_text` — pasted/edited text.
2. `profiles.resume_file_path` — an uploaded PDF in the `resumes` storage bucket.

`parseProfile` **prefers the PDF** whenever a file path is set (the coordinate parser
yields richer structure than flat text). `resolveResumeFilePath` tries to keep the two
consistent by dropping the PDF when pasted text changes — but only on the *text-change
transition*. When that transition is missed (undeployed fix, a no-op save, an import),
the PDF goes stale and silently overrides newer text. This produced the "wrong city"
bug: `resume_text` said Phoenix, the stale PDF said San Diego, generation used the PDF.

The root fragility is having two sources with an implicit winner and a brittle sync.

## Goals

- **One source of truth: `resume_text`.** Generation always parses `resume_text` and
  never re-parses a stored file. "Most recent write wins" becomes automatic — there is
  only one source.
- **Uploads are an input method, not a second source.** Uploading a file extracts its
  content into `resume_text` (as markdown), which the user reviews before it commits.
- **Preserve extraction quality.** Reuse the coordinate parser so uploaded PDFs produce
  clean, structured, *complete* markdown (Option B) — not lossy flat text.
- **Extensible to more file types** later via a small extractor seam (PDF now; `.docx`
  etc. later) without reworking the pipeline.
- **Keep the uploaded file** as an archival artifact (download / future re-extraction),
  clearly distinct from the editable source of truth.

## Non-goals

- Adding non-PDF extractors now (just leave the seam).
- LLM-based extraction (Option C) — noted as a future fidelity upgrade, not built now.
- A structured (form-based) résumé editor — the source of truth stays free-text markdown.

## Architecture

### Single source of truth

`resume_text` is canonical. The generation read path (`getResumeSource` →
`generateResume`) uses **only** `resume_text`:

- `getResumeSource` stops downloading the PDF; returns `{ resumeText }` only.
- `generateResume` / `parseProfile` lose the PDF branch — parsing is text-only via
  `parseProfileText` (which now understands markdown, per `fe54af1`).
- `resolveResumeFilePath` and its drop-logic are removed. `resume_file_path` simply
  records the last uploaded file; it never competes as a parse source, so it can never
  go "stale" in a way that affects output.

This deletes the entire stale-PDF failure class.

### Upload → text extraction (Option B, review-before-commit)

On file upload, convert the file to **complete markdown** and place it in the editable
résumé text box for the user to review/fix; it commits to `resume_text` only when they
save.

New seam:

```
// dashboard/lib/rolefit/fileToResumeMarkdown.ts (new)
type ResumeFileType = "pdf"; // extend later: "docx" | ...
async function fileToResumeMarkdown(bytes: Uint8Array, type: ResumeFileType): Promise<string>
```

For PDF, the converter reuses the existing coordinate parser and a new serializer:

```
extractPdfItems(bytes) → parsePdfItems(...) → ParsedProfile
                                            → serializeProfileToMarkdown(profile, leftoverLines) → markdown
```

**Prose preservation (critical):** `parsePdfItems` captures structure (name, contact,
experience, education, certifications) but drops prose sections (Summary, Skills), which
`buildResumePrompt` feeds the LLM as background context for skills/domain/tenure.
The serializer must therefore emit BOTH:

- Structured sections as clean markdown: `# Name`, contact line, `## Experience` with
  `### Company` / `#### Role · dates`, bullets, `## Education`, `## Certifications`.
- Remaining un-consumed lines (Summary, Skills, anything the structured parse didn't
  claim) preserved verbatim under their own `##` headings. These "leftovers" require
  `parsePdfItems` to also surface the lines it did NOT assign to a structured field
  (today it discards them) — either by returning them alongside the `ParsedProfile` or
  via a sibling helper the serializer consumes.

The emitted markdown is exactly the dialect `parseProfileText` already parses, so the
round-trip (`serialize → parseProfileText`) reproduces the structured fields, and the
prose remains as LLM context. If clean structure+prose serialization proves infeasible
for a given layout, the converter degrades to including the raw extracted text so no
content is ever lost (the user then fixes it in the review box).

### Upload UX

The `/profile` page (and the board's résumé modal) get a review step: selecting a file
extracts to markdown and fills the résumé text box; the user eyeballs/edits it, then
saves. Save writes `resume_text` (the reviewed markdown) and records `resume_file_path`
(archival). Extraction runs server-side (unpdf). The exact wiring — a client
extract-on-select endpoint that populates the textarea, vs. a two-step server
round-trip that re-renders the form pre-filled — is deferred to the plan (both satisfy
the review UX; pick the simpler). Either way, final commit is the normal save.

## Parallel fixes (same subsystem, ship alongside)

### 1. `links` double-encoding (code + data repair)

`upsertProfile` writes `${JSON.stringify(data.links)}::jsonb`, which is correct when
`data.links` is an object. But the board résumé-modal save (`app/actions/profile.ts`)
passes `existing?.links ?? {}` straight through. If `getProfile` ever returns `links` as
a **string scalar** (a double-encoded jsonb value read back as a JS string — see
`dashboard/CLAUDE.md`), each subsequent modal save re-`JSON.stringify`s it, compounding
the escaping. The prod value is now a multiply-escaped string.

- **Code fix:** read `links` through a **total parser** at the `getProfile` boundary
  (unwrap up to N levels of accidental string-encoding → validated `ProfileLinks`
  object or a safe default), colocated with the type, matching the house `packageCodec`
  pattern. Never let a string round-trip back into the write path. Add a regression test.
- **Data repair:** rewrite the row's `links` to the decoded object
  `{ linkedin, github, portfolio }` (values already recovered).

### 2. `full_name` / `location` scramble (data repair + audit)

Prod has `full_name = "Andrew"`, `location = "Malvani"` — the name is split across the
two fields; `location` should be a city.

- **Data repair:** set `full_name = "Andrew Malvani"`, `location = "Phoenix, AZ"`
  (confirm the city with the user).
- **Audit:** check the profile save path for any code that could split a name across
  these fields; if none (likely a data-entry/import artifact), no code change.

## Error handling

- Extraction failure (unreadable/empty file): surface a clear inline error; never
  silently overwrite good `resume_text` with empty/garbage output.
- The `links` parser is total: malformed input degrades to a safe default, never throws
  into a page render.

## Testing

- `serializeProfileToMarkdown`: round-trip on the committed scrubbed fixture —
  `parseProfileText(serialize(parsePdfItems(scrubbedItems)))` deep-equals the structured
  fields; assert Summary/Skills prose is preserved in the markdown.
- `fileToResumeMarkdown`: gated binary smoke on the real PDF fixture (like the existing
  `parseProfile` smoke), asserting non-PII facts.
- `links` boundary parser: unit tests for object, 1×/2×/3×-encoded string, null, garbage.
- Generation read path: `getResumeSource` returns text-only; no PDF download.
- Existing `parseProfile` markdown/flattened tests continue to pass unchanged.

## Migration / rollout

- No schema change required (`resume_file_path` stays, repurposed as archival).
- Data repairs (`links`, name/location) run once against prod via the Supabase MCP.
- Frontend + lib change; deploys via push-to-main (Vercel). No migration-coupling.

## Open questions

- Confirm `location` value ("Phoenix, AZ"?).
- Confirm the review-step wiring approach (client extract-on-select endpoint vs. a
  two-step server round-trip) at plan time — both satisfy the UX; pick the simpler.
