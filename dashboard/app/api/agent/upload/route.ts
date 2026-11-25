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
//   413 { error: "too_large" }              over 4 MiB (by Content-Length before reading, then by size)
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

  let form: FormData;
  try {
    form = await req.formData();
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
