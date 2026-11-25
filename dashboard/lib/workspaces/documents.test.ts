// The documents library (plan Task 1.10). Storage, the database, the budget, the model
// and the PDF parser are mocked: no real model, storage or database is touched.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  from: vi.fn(),
  queries: [] as Array<{ text: string; values: unknown[] }>,
  rows: [] as unknown[][],
  checkBudget: vi.fn(),
  chargeFlat: vi.fn(),
  generateText: vi.fn(),
  agentModel: vi.fn(),
  fileToResumeMarkdown: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ storage: { from: (bucket: string) => (m.from(bucket), { upload: m.upload, remove: m.remove }) } }),
}));
vi.mock("@/lib/db", () => ({
  withUserSql: async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
    const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
      m.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(m.rows.shift() ?? []);
    };
    return fn(tx);
  },
}));
vi.mock("@/lib/agent/budget", async (orig) => ({
  ...(await orig<typeof import("@/lib/agent/budget")>()),
  checkBudget: m.checkBudget,
}));
vi.mock("@/lib/agent/runs", () => ({ chargeFlat: m.chargeFlat }));
vi.mock("@/lib/agent/provider", () => ({ agentModel: m.agentModel }));
vi.mock("ai", () => ({ generateText: m.generateText }));
vi.mock("@/lib/rolefit/fileToResumeMarkdown", () => ({ fileToResumeMarkdown: m.fileToResumeMarkdown }));

import {
  createDocument,
  deleteDocument,
  EXTRACTED_TEXT_MAX,
  MAX_UPLOAD_BYTES,
  readDocumentText,
  sniffMime,
  UploadError,
  VISION_PROMPT,
} from "@/lib/workspaces/documents";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
const text = (s: string) => new TextEncoder().encode(s);

function insertRow(values: unknown[]) {
  return [{ id: values[0], kind: values[2], filename: values[3], mime: values[4], bytes: values[5], extraction: values[8], created_at: new Date("2026-11-25T00:00:00Z") }];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh arrays: some tests wrap queries.push to answer or fail the INSERT.
  m.queries = [];
  m.rows = [];
  m.upload.mockResolvedValue({ data: {}, error: null });
  m.remove.mockResolvedValue({ data: [], error: null });
  m.checkBudget.mockResolvedValue({ ok: true, remainingMicros: 1_000_000 });
  m.chargeFlat.mockResolvedValue({ ok: true });
  m.agentModel.mockReturnValue({ fake: "model" });
  m.generateText.mockResolvedValue({ text: "Transcribed text", usage: { inputTokens: 1000, outputTokens: 50 }, providerMetadata: undefined });
  m.fileToResumeMarkdown.mockResolvedValue("# Jane Doe\n\nEngineer");
});

const create = (a: { filename: string; bytes: Uint8Array; declaredMime: string }) => createDocument(USER, a);

/** Makes the fake answer the document INSERT with a row built from its own values. */
function answerInsertsFromValues() {
  const push = m.queries.push.bind(m.queries);
  m.queries.push = (...items) => {
    for (const q of items) if (/INSERT INTO documents/.test(q.text)) m.rows.unshift(insertRow(q.values));
    return push(...items);
  };
}

test.each([
  ["0 bytes", { filename: "a.pdf", bytes: new Uint8Array(), declaredMime: "application/pdf" }, "empty"],
  ["4 MiB + 1 byte", { filename: "a.pdf", bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1), declaredMime: "application/pdf" }, "too_large"],
  ["HEIC bytes named photo.jpg", { filename: "photo.jpg", bytes: HEIC, declaredMime: "image/jpeg" }, "type_mismatch"],
  ["PNG bytes declared application/pdf", { filename: "scan.pdf", bytes: PNG, declaredMime: "application/pdf" }, "type_mismatch"],
  ["a .exe", { filename: "setup.exe", bytes: EXE, declaredMime: "application/x-msdownload" }, "type_not_allowed"],
])("%s -> %s", async (_name, input, code) => {
  await expect(createDocument(USER, input)).rejects.toMatchObject({ name: "UploadError", code });
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.queries).toHaveLength(0);
  expect(m.generateText).not.toHaveBeenCalled();
});

test("sniffMime reads magic numbers and UTF-8 text", () => {
  expect(sniffMime(PDF)).toBe("application/pdf");
  expect(sniffMime(PNG)).toBe("image/png");
  expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(sniffMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  expect(sniffMime(text("# Notes\nplain text ✓"))).toBe("text/plain");
  expect(sniffMime(new Uint8Array([0x68, 0x00, 0x69]))).toBeNull();
  expect(sniffMime(new Uint8Array([0xc3, 0x28]))).toBeNull();
  expect(sniffMime(HEIC)).toBeNull();
});

test("a scanned PDF with no text is stored with extraction 'empty', never as an empty-string résumé", async () => {
  answerInsertsFromValues();
  m.fileToResumeMarkdown.mockResolvedValue("   \n ");
  const meta = await create({ filename: "scan.pdf", bytes: PDF, declaredMime: "application/pdf" });
  expect(meta.extraction).toBe("empty");
  const insert = m.queries.find((q) => /INSERT INTO documents/.test(q.text));
  expect(insert?.values[7]).toBeNull();
  expect(insert?.values[8]).toBe("empty");
});

test("the storage path is generated server side and ignores a client path or '../' in the name", async () => {
  answerInsertsFromValues();
  const meta = await create({ filename: "../../other-user/notes.md", bytes: text("hello"), declaredMime: "text/markdown; charset=utf-8" });
  const [path] = m.upload.mock.calls[0];
  expect(path).toBe(`${USER}/doc-${meta.id}-notes.md`);
  expect(m.from).toHaveBeenCalledWith("resumes");
  const insert = m.queries.find((q) => /INSERT INTO documents/.test(q.text));
  expect(insert?.values[6]).toBe(path);
  expect(insert?.values[3]).toBe("notes.md");
  expect(meta).toMatchObject({ filename: "notes.md", mime: "text/markdown", extraction: "ok", kind: "other" });
});

test.each([
  ["", "notes.md", "text/markdown"],
  ["application/octet-stream", "notes.markdown", "text/markdown"],
  ["", "plan.TXT", "text/plain"],
  ["application/octet-stream", "plan.txt", "text/plain"],
])("declared %j with a %s name and text bytes is stored as %s", async (declaredMime, filename, mime) => {
  answerInsertsFromValues();
  const meta = await create({ filename, bytes: text("# Notes\nhello"), declaredMime });
  expect(meta).toMatchObject({ mime, extraction: "ok" });
  expect(m.upload.mock.calls[0][2]).toMatchObject({ contentType: mime });
});

test.each([
  ["PNG bytes named notes.md, no declared type", { filename: "notes.md", bytes: PNG, declaredMime: "" }, "type_mismatch"],
  ["PDF bytes named plan.txt as octet-stream", { filename: "plan.txt", bytes: PDF, declaredMime: "application/octet-stream" }, "type_mismatch"],
  ["no declared type and no text extension", { filename: "cv.pdf", bytes: PDF, declaredMime: "" }, "type_not_allowed"],
  ["octet-stream with an unknown extension", { filename: "notes.doc", bytes: text("hello"), declaredMime: "application/octet-stream" }, "type_not_allowed"],
])("%s -> %s", async (_name, input, code) => {
  await expect(createDocument(USER, input)).rejects.toMatchObject({ name: "UploadError", code });
  expect(m.upload).not.toHaveBeenCalled();
});

test("Storage-unsafe characters never reach the object key; the row keeps the original name", async () => {
  answerInsertsFromValues();
  const meta = await create({ filename: "résumé #2?%[draft].md", bytes: text("hello"), declaredMime: "text/markdown" });
  const [path] = m.upload.mock.calls[0];
  const name = String(path).slice(`${USER}/doc-${meta.id}-`.length);
  expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  expect(name.endsWith(".md")).toBe(true);
  expect(meta.filename).toBe("résumé #2?%[draft].md");
});

test("an image upload over budget is rejected before any model call", async () => {
  m.checkBudget.mockResolvedValue({ ok: false, reason: "daily_ceiling" });
  await expect(createDocument(USER, { filename: "card.png", bytes: PNG, declaredMime: "image/png" })).rejects.toMatchObject({ code: "budget" });
  expect(m.generateText).not.toHaveBeenCalled();
  expect(m.upload).not.toHaveBeenCalled();
  expect(m.chargeFlat).not.toHaveBeenCalled();
});

test("an image is transcribed by one vision call and charged through chargeFlat", async () => {
  answerInsertsFromValues();
  const meta = await create({ filename: "card.png", bytes: PNG, declaredMime: "image/png" });
  expect(m.generateText).toHaveBeenCalledTimes(1);
  const call = m.generateText.mock.calls[0][0];
  expect(call.messages[0].content[0]).toEqual({ type: "text", text: VISION_PROMPT });
  expect(call.messages[0].content[1]).toMatchObject({ type: "image", mediaType: "image/png" });
  expect(m.chargeFlat).toHaveBeenCalledWith(USER, expect.objectContaining({ kind: "vision" }));
  expect(m.chargeFlat.mock.calls[0][1].costMicros).toBeGreaterThan(0);
  expect(meta).toMatchObject({ kind: "photo", extraction: "ok" });
  // The model call ran before the row was written; nothing ran inside a transaction.
  expect(m.generateText.mock.invocationCallOrder[0]).toBeLessThan(m.chargeFlat.mock.invocationCallOrder[0]);
});

test("a failed vision call stores extraction 'failed' and charges nothing", async () => {
  answerInsertsFromValues();
  m.generateText.mockRejectedValue(new Error("provider down"));
  const meta = await create({ filename: "card.png", bytes: PNG, declaredMime: "image/png" });
  expect(meta.extraction).toBe("failed");
  expect(m.chargeFlat).not.toHaveBeenCalled();
});

test("extracted text is cut to 60000 chars", async () => {
  answerInsertsFromValues();
  await create({ filename: "long.txt", bytes: text("é".repeat(EXTRACTED_TEXT_MAX + 500)), declaredMime: "text/plain" });
  const insert = m.queries.find((q) => /INSERT INTO documents/.test(q.text));
  expect(Array.from(String(insert?.values[7]))).toHaveLength(EXTRACTED_TEXT_MAX);
});

test("a failed insert removes the uploaded object again", async () => {
  const push = m.queries.push.bind(m.queries);
  m.queries.push = (...items) => {
    for (const q of items) if (/INSERT INTO documents/.test(q.text)) throw new Error("insert failed");
    return push(...items);
  };
  await expect(createDocument(USER, { filename: "a.txt", bytes: text("x"), declaredMime: "text/plain" })).rejects.toThrow("insert failed");
  const [path] = m.upload.mock.calls[0];
  expect(m.remove).toHaveBeenCalledWith([path]);
});

test("readDocumentText and deleteDocument refuse a malformed id without a query", async () => {
  expect(await readDocumentText(USER, "../x")).toBeNull();
  await deleteDocument(USER, "../x");
  expect(m.queries).toHaveLength(0);
  expect(m.remove).not.toHaveBeenCalled();
});

test("deleteDocument removes the object, then the row", async () => {
  const id = "11111111-2222-4333-8444-555555555555";
  m.rows.push([{ storage_path: `${USER}/doc-${id}-a.pdf` }], []);
  await deleteDocument(USER, id);
  expect(m.remove).toHaveBeenCalledWith([`${USER}/doc-${id}-a.pdf`]);
  expect(m.queries.map((q) => q.text.trim().split(/\s+/)[0])).toEqual(["SELECT", "DELETE"]);
});

test("deleteDocument keeps the row when the object cannot be removed", async () => {
  const id = "11111111-2222-4333-8444-555555555555";
  m.rows.push([{ storage_path: `${USER}/doc-${id}-a.pdf` }]);
  m.remove.mockResolvedValue({ data: null, error: { message: "boom" } });
  await expect(deleteDocument(USER, id)).rejects.toThrow("storage remove failed");
  expect(m.queries.map((q) => q.text.trim().split(/\s+/)[0])).toEqual(["SELECT"]);
});

test("UploadError carries its code", () => {
  expect(new UploadError("budget").code).toBe("budget");
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("deleteDocument is not exported to any agent tool module", () => {
  for (const file of filesUnder("lib/agent/tools").filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))) {
    // No tool module names it, imports it, or pulls in the whole library with `* as`.
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toMatch(/deleteDocument/);
    expect(source, file).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+"@\/lib\/workspaces\/documents"/);
  }
});
