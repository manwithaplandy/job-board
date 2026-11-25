// The documents library against real Postgres and RLS (plan Task 1.10): the generated
// Storage key satisfies the table's owner check, reads are the caller's own, and delete
// removes the object then the row. Storage is mocked. Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

const storage = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ storage: { from: () => ({ upload: storage.upload, remove: storage.remove }) } }),
}));

import { openTestDb, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { createDocument, deleteDocument, listDocuments, readDocumentText } from "@/lib/workspaces/documents";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});
beforeEach(async () => {
  vi.clearAllMocks();
  storage.upload.mockResolvedValue({ data: {}, error: null });
  storage.remove.mockResolvedValue({ data: [], error: null });
  await db.sql`DELETE FROM documents`;
});

const enc = (s: string) => new TextEncoder().encode(s);

test("a text upload is stored under the owner check and read back by its owner only", async () => {
  const meta = await createDocument(USER_A, { filename: "../x/notes.md", bytes: enc("# Notes\nGo and Postgres"), declaredMime: "text/markdown" });
  expect(meta).toMatchObject({ filename: "notes.md", mime: "text/markdown", extraction: "ok", kind: "other", bytes: 23 });
  const [row] = await db.sql`SELECT storage_path, extracted_text FROM documents WHERE id = ${meta.id}`;
  expect(row.storage_path).toBe(`${USER_A}/doc-${meta.id}-notes.md`);
  expect(row.extracted_text).toBe("# Notes\nGo and Postgres");

  expect((await listDocuments(USER_A)).map((d) => d.id)).toEqual([meta.id]);
  expect(await listDocuments(USER_B)).toEqual([]);
  expect((await readDocumentText(USER_A, meta.id))?.text).toBe("# Notes\nGo and Postgres");
  expect(await readDocumentText(USER_B, meta.id)).toBeNull();
});

test("only the owner can delete; the object goes first, then the row", async () => {
  const meta = await createDocument(USER_A, { filename: "a.txt", bytes: enc("hello"), declaredMime: "text/plain" });
  await deleteDocument(USER_B, meta.id);
  expect(storage.remove).not.toHaveBeenCalled();
  expect(await db.sql`SELECT 1 FROM documents WHERE id = ${meta.id}`).toHaveLength(1);

  await deleteDocument(USER_A, meta.id);
  expect(storage.remove).toHaveBeenCalledWith([`${USER_A}/doc-${meta.id}-a.txt`]);
  expect(await db.sql`SELECT 1 FROM documents WHERE id = ${meta.id}`).toHaveLength(0);
});
