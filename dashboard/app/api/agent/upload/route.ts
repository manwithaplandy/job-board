import { getUserClaims } from "@/lib/auth";
import { getViewerPlan } from "@/lib/subscriptions";
import { AccountDeletedError, assertNotDeleted } from "@/lib/tombstone";
import { createDocument, MAX_UPLOAD_BYTES, UploadError, type UploadErrorCode } from "@/lib/workspaces/documents";

export const dynamic = "force-dynamic";
// One upload: storage, then at most one vision call for an image.
export const maxDuration = 60;

// Document upload for the agent and the documents page (plan Task 1.10). Authed only:
// NOT in PUBLIC_PREFIXES. Multipart with one field, `file`; any other field (a client
// path, a storage key) is ignored, because the Storage key is generated server side.
//   403 { error: "forbidden" }              Sec-Fetch-Site is cross-site or same-site
//   401 no session (or an erased account's stale JWT)
//   402 { error: "subscription_required" }  no plan
//   400 { error: "bad_request" }            not multipart, or no `file` field
//   413 { error: "too_large" }              over 4 MiB (by Content-Length before reading, by a hard
//                                           cap while reading, then by the file's size)
//   415 { error: "type_not_allowed" | "type_mismatch" }
//   422 { error: "empty" }
//   429 { error: "budget" }                 an image while the agent budget is not ok
//   200 { document: DocumentMeta }

// Room for the multipart boundaries and headers around one file.
const MULTIPART_OVERHEAD = 64 * 1024;

const STATUS: Record<UploadErrorCode, number> = {
  too_large: 413,
  type_not_allowed: 415,
  type_mismatch: 415,
  empty: 422,
  budget: 429,
};

const json = (body: unknown, status: number) => Response.json(body, { status });

/** The whole body, or null as soon as it passes `cap` bytes (the rest is never read). */
async function readCapped(req: Request, cap: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export async function POST(req: Request): Promise<Response> {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return json({ error: "forbidden" }, 403);

  const claims = await getUserClaims();
  if (!claims) return json({ error: "sign in" }, 401);
  const userId = claims.id;
  try {
    await assertNotDeleted(userId);
  } catch (e) {
    if (e instanceof AccountDeletedError) return json({ error: "sign in" }, 401);
    throw e;
  }
  const plan = await getViewerPlan(userId, claims.email);
  if (!plan) return json({ error: "subscription_required" }, 402);

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "multipart/form-data") return json({ error: "bad_request" }, 400);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD) return json({ error: "too_large" }, 413);

  // Read the body ourselves with a hard byte cap, so a request without Content-Length
  // (a chunked or streamed body) cannot make formData() buffer more than the limit.
  const body = await readCapped(req, MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD);
  if (body === null) return json({ error: "too_large" }, 413);
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": req.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "bad_request" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "too_large" }, 413);

  try {
    const document = await createDocument(userId, {
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMime: file.type,
    });
    return json({ document }, 200);
  } catch (e) {
    if (e instanceof UploadError) return json({ error: e.code }, STATUS[e.code]);
    throw e;
  }
}
