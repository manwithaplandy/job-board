// The documents library (plan Task 1.10): files the user uploads for the agent to read.
//
// The checks run on the server, on the bytes: size, an allowed declared type, and the
// declared type must match what the bytes are (magic numbers; valid UTF-8 for text).
// The Storage key is generated here (documentObjectPath) and nothing from the client
// shapes it but the sanitized file name. Text extraction runs before the row is
// written and outside any transaction: PDF through the résumé parser, an image through
// one vision call charged to the agent budget (refused up front when the budget is not
// ok), text by decoding. A file with no readable text is stored with extraction
// "empty" and no text, never as an empty string.
//
// deleteDocument is the user's alone: no module under lib/agent/tools may import it
// (documents.test.ts checks the import graph).
import { randomUUID } from "node:crypto";
import { generateText } from "ai";
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { checkBudget, stepCostMicros } from "@/lib/agent/budget";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";
import { agentModel } from "@/lib/agent/provider";
import { chargeFlat } from "@/lib/agent/runs";
import { documentObjectPath, sanitizeUploadFilename } from "@/lib/resumeStorage";
import { fileToResumeMarkdown } from "@/lib/rolefit/fileToResumeMarkdown";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseOrNull } from "@/lib/zodParse";
import type { DocumentMeta } from "@/lib/workspaces/types";

export const MAX_UPLOAD_BYTES = 4_194_304;
export const ALLOWED_UPLOAD_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"] as const;
export const EXTRACTED_TEXT_MAX = 60_000;
export const VISION_PROMPT = "transcribe the text in this image, output text only";

type AllowedMime = (typeof ALLOWED_UPLOAD_MIME)[number];
const BUCKET = "resumes";
const FILENAME_MAX = 255;
const VISION_MAX_OUTPUT_TOKENS = 4000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UploadErrorCode = "too_large" | "empty" | "type_not_allowed" | "type_mismatch" | "budget";

/** An upload the server refuses, with the reason the route maps to a status. */
export class UploadError extends Error {
  constructor(readonly code: UploadErrorCode) {
    super(
      {
        too_large: "That file is larger than 4 MB.",
        empty: "That file is empty.",
        type_not_allowed: "Upload a PDF, PNG, JPEG, WebP, plain-text or Markdown file.",
        type_mismatch: "That file's contents do not match its type.",
        budget: "Reading text from images is paused: your agent budget is used up for now.",
      }[code],
    );
    this.name = "UploadError";
  }
}

/** What the bytes are: PDF, PNG, JPEG or WebP by magic number, or text/plain for valid UTF-8 with no NUL. */
export function sniffMime(bytes: Uint8Array): string | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 12 && starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (bytes.length === 0 || bytes.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "text/plain";
  } catch {
    return null;
  }
}

function normalizeMime(declared: string): string {
  return declared.split(";")[0].trim().toLowerCase();
}

function isAllowed(mime: string): mime is AllowedMime {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(mime);
}

/** Markdown is text: its bytes sniff as text/plain. */
function matches(declared: AllowedMime, sniffed: string | null): boolean {
  if (sniffed === null) return false;
  if (declared === "text/markdown") return sniffed === "text/plain";
  return declared === sniffed;
}

/** At most `max` code points (the column's char_length), never splitting a surrogate pair. */
function cutCodePoints(text: string, max: number): string {
  const points = Array.from(text);
  return points.length <= max ? text : points.slice(0, max).join("");
}

type Extracted = { text: string | null; extraction: DocumentMeta["extraction"] };

function finish(raw: string): Extracted {
  const text = cutCodePoints(raw.replace(/\u0000/g, "").trim(), EXTRACTED_TEXT_MAX);
  return text === "" ? { text: null, extraction: "empty" } : { text, extraction: "ok" };
}

async function transcribeImage(userId: string, bytes: Uint8Array, mime: AllowedMime): Promise<Extracted> {
  const model = AGENT_MODEL_DEFAULT;
  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: agentModel(model),
      maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image", image: bytes, mediaType: mime }] }],
    });
  } catch (error) {
    console.error("[documents.vision]", error);
    return { text: null, extraction: "failed" };
  }
  const costMicros = stepCostMicros({ providerMetadata: result.providerMetadata, usage: result.usage }, model);
  await chargeFlat(userId, { kind: "vision", model, costMicros });
  return finish(result.text);
}

async function extract(userId: string, bytes: Uint8Array, mime: AllowedMime): Promise<Extracted> {
  if (mime === "application/pdf") {
    try {
      return finish(await fileToResumeMarkdown(bytes, "pdf"));
    } catch (error) {
      console.error("[documents.pdf]", error);
      return { text: null, extraction: "failed" };
    }
  }
  if (mime === "text/plain" || mime === "text/markdown") return finish(new TextDecoder("utf-8").decode(bytes));
  return transcribeImage(userId, bytes, mime);
}

const metaRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["resume", "photo", "other"]),
  filename: z.string(),
  mime: z.string(),
  bytes: z.coerce.number().int().nonnegative(),
  extraction: z.enum(["ok", "empty", "failed"]),
  created_at: z.coerce.date(),
});

function toMeta(raw: unknown): DocumentMeta | null {
  const r = parseOrNull(metaRowSchema, raw);
  if (!r || Number.isNaN(r.created_at.getTime())) return null;
  return { id: r.id, kind: r.kind, filename: r.filename, mime: r.mime, bytes: r.bytes, extraction: r.extraction, createdAt: r.created_at.toISOString() };
}

/**
 * Validates, stores and extracts one upload, and records it. Throws UploadError for a
 * refused file. The object is removed again if the row cannot be written.
 */
export async function createDocument(
  userId: string,
  a: { filename: string; bytes: Uint8Array; declaredMime: string },
): Promise<DocumentMeta> {
  const bytes = a.bytes;
  if (bytes.length === 0) throw new UploadError("empty");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  const declared = normalizeMime(a.declaredMime);
  if (!isAllowed(declared)) throw new UploadError("type_not_allowed");
  if (!matches(declared, sniffMime(bytes))) throw new UploadError("type_mismatch");
  const isImage = declared.startsWith("image/");
  if (isImage) {
    const budget = await checkBudget(userId);
    if (!budget.ok) throw new UploadError("budget");
  }

  const id = randomUUID();
  const filename = Array.from(sanitizeUploadFilename(a.filename)).slice(-FILENAME_MAX).join("");
  const path = documentObjectPath(userId, id, filename);
  const bucket = getSupabaseAdmin().storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: declared, upsert: false });
  if (uploadError) throw new Error(`documents: storage upload failed: ${uploadError.message}`);

  try {
    const { text, extraction } = await extract(userId, bytes, declared);
    const rows = await withUserSql(userId, (tx) => tx`
      INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extracted_text, extraction)
      VALUES (${id}::uuid, ${userId}::uuid, ${isImage ? "photo" : "other"}, ${filename}, ${declared}, ${bytes.length},
              ${path}, ${text}, ${extraction})
      RETURNING id, kind, filename, mime, bytes, extraction, created_at`);
    const meta = toMeta(rows[0]);
    if (!meta) throw new Error("documents: the new row failed the parse");
    return meta;
  } catch (error) {
    const { error: removeError } = await bucket.remove([path]);
    if (removeError) console.error("[documents.cleanup]", removeError.message);
    throw error;
  }
}

/** The caller's documents, newest first, without their text. */
export async function listDocuments(userId: string): Promise<DocumentMeta[]> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, kind, filename, mime, bytes, extraction, created_at
    FROM documents WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC, id`);
  const out: DocumentMeta[] = [];
  for (const raw of rows) {
    const meta = toMeta(raw);
    if (meta) out.push(meta);
  }
  return out;
}

/** One of the caller's documents with its extracted text; null when there is no such document. */
export async function readDocumentText(userId: string, id: string): Promise<{ meta: DocumentMeta; text: string | null } | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT id, kind, filename, mime, bytes, extraction, created_at, extracted_text
    FROM documents WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`);
  const meta = toMeta(rows[0]);
  if (!meta) return null;
  const text = parseOrNull(z.object({ extracted_text: z.string().nullable() }), rows[0])?.extracted_text ?? null;
  return { meta, text };
}

/** Deletes one of the caller's documents: the Storage object first, then the row. A no-op for an unknown id. */
export async function deleteDocument(userId: string, id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT storage_path FROM documents WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`);
  const row = parseOrNull(z.object({ storage_path: z.string() }), rows[0]);
  if (!row) return;
  // The table's check ties the path to this user and this document; refuse anything else.
  if (!row.storage_path.startsWith(`${userId}/doc-${id}-`)) throw new Error("documents: unexpected storage path");
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove([row.storage_path]);
  if (error) throw new Error(`documents: storage remove failed: ${error.message}`);
  await withUserSql(userId, (tx) => tx`DELETE FROM documents WHERE id = ${id}::uuid AND user_id = ${userId}::uuid`);
}
