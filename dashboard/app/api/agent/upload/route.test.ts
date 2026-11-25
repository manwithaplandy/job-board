// POST /api/agent/upload (plan Task 1.10). The session, plan, Storage, database, budget
// and model are mocked; the real documents library runs, so the statuses below are the
// library's refusals mapped by the route. No real model, storage or database is touched.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => {
  class AccountDeletedError extends Error {}
  return {
    AccountDeletedError,
    getUserClaims: vi.fn(),
    getViewerPlan: vi.fn(),
    assertNotDeleted: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    inserts: [] as unknown[][],
    checkBudget: vi.fn(),
    chargeFlat: vi.fn(),
    generateText: vi.fn(),
  };
});
vi.mock("@/lib/auth", () => ({ getUserClaims: m.getUserClaims }));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: m.getViewerPlan }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted, AccountDeletedError: m.AccountDeletedError }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ storage: { from: () => ({ upload: m.upload, remove: m.remove }) } }),
}));
vi.mock("@/lib/db", () => ({
  withUserSql: async (_u: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn((_s: TemplateStringsArray, ...v: unknown[]) => {
      m.inserts.push(v);
      return Promise.resolve([{ id: v[0], kind: v[2], filename: v[3], mime: v[4], bytes: v[5], extraction: v[8], created_at: new Date("2026-11-25T00:00:00Z") }]);
    }),
}));
vi.mock("@/lib/agent/budget", async (orig) => ({ ...(await orig<typeof import("@/lib/agent/budget")>()), checkBudget: m.checkBudget }));
vi.mock("@/lib/agent/runs", () => ({ chargeFlat: m.chargeFlat }));
vi.mock("@/lib/agent/provider", () => ({ agentModel: () => ({ fake: "model" }) }));
vi.mock("ai", () => ({ generateText: m.generateText }));
vi.mock("@/lib/rolefit/fileToResumeMarkdown", () => ({ fileToResumeMarkdown: vi.fn().mockResolvedValue("text") }));

import { POST, dynamic, maxDuration } from "@/app/api/agent/upload/route";
import { MAX_UPLOAD_BYTES } from "@/lib/workspaces/documents";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

function upload(parts: Record<string, Blob | string>, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(parts)) form.append(k, v);
  return new Request("http://localhost/api/agent/upload", { method: "POST", body: form, headers });
}
const file = (bytes: Uint8Array<ArrayBuffer> | string, name: string, type: string) => new File([bytes], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  m.inserts = [];
  m.getUserClaims.mockResolvedValue({ id: USER, email: "a@example.com" });
  m.getViewerPlan.mockResolvedValue("standard");
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.upload.mockResolvedValue({ data: {}, error: null });
  m.remove.mockResolvedValue({ data: [], error: null });
  m.checkBudget.mockResolvedValue({ ok: true, remainingMicros: 1_000_000 });
  m.chargeFlat.mockResolvedValue({ ok: true });
  m.generateText.mockResolvedValue({ text: "Card text", usage: { inputTokens: 100, outputTokens: 10 }, providerMetadata: undefined });
});

test("route config", () => {
  expect(dynamic).toBe("force-dynamic");
  expect(maxDuration).toBe(60);
});

test("gates: cross-site 403, no session 401, erased account 401, no plan 402", async () => {
  expect((await POST(upload({ file: file("x", "a.txt", "text/plain") }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  m.getUserClaims.mockResolvedValueOnce(null);
  expect((await POST(upload({ file: file("x", "a.txt", "text/plain") }))).status).toBe(401);
  m.assertNotDeleted.mockRejectedValueOnce(new m.AccountDeletedError());
  expect((await POST(upload({ file: file("x", "a.txt", "text/plain") }))).status).toBe(401);
  m.getViewerPlan.mockResolvedValueOnce(null);
  const res = await POST(upload({ file: file("x", "a.txt", "text/plain") }));
  expect(res.status).toBe(402);
  expect(await res.json()).toEqual({ error: "subscription_required" });
  expect(m.upload).not.toHaveBeenCalled();
});

test("a declared Content-Length over the limit is refused before the body is read", async () => {
  const req = new Request("http://localhost/api/agent/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(MAX_UPLOAD_BYTES * 2) },
    body: "--x--",
  });
  const formData = vi.spyOn(req, "formData");
  const res = await POST(req);
  expect(res.status).toBe(413);
  expect(await res.json()).toEqual({ error: "too_large" });
  expect(formData).not.toHaveBeenCalled();
});

test.each([
  ["an empty file", file(new Uint8Array(), "a.txt", "text/plain"), 422, "empty"],
  ["a file over 4 MiB", file(new Uint8Array(MAX_UPLOAD_BYTES + 1), "a.pdf", "application/pdf"), 413, "too_large"],
  ["an .exe", file(new Uint8Array([0x4d, 0x5a, 0, 0]), "setup.exe", "application/x-msdownload"), 415, "type_not_allowed"],
  ["PNG bytes declared as PDF", file(PNG, "scan.pdf", "application/pdf"), 415, "type_mismatch"],
])("%s -> %i %s", async (_name, f, status, error) => {
  const res = await POST(upload({ file: f }));
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error });
  expect(m.upload).not.toHaveBeenCalled();
});

test("an image over budget is 429 before any model call", async () => {
  m.checkBudget.mockResolvedValue({ ok: false, reason: "monthly_ceiling" });
  const res = await POST(upload({ file: file(PNG, "card.png", "image/png") }));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: "budget" });
  expect(m.generateText).not.toHaveBeenCalled();
});

test("a missing or non-file field is 400", async () => {
  expect((await POST(upload({ other: file("x", "a.txt", "text/plain") }))).status).toBe(400);
  expect((await POST(upload({ file: "just text" }))).status).toBe(400);
});

test("a good upload is 200 with the document; a client path field is ignored", async () => {
  const res = await POST(upload({ file: file("hello", "../../b/notes.txt", "text/plain"), path: `${USER}/../x`, storage_path: "evil" }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.document).toMatchObject({ filename: "notes.txt", mime: "text/plain", extraction: "ok" });
  const [path] = m.upload.mock.calls[0];
  expect(path).toBe(`${USER}/doc-${body.document.id}-notes.txt`);
});
