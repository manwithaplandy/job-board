// Résumé Storage object-key helpers.
//
// SECURITY (M-STORAGE-DELETE): résumé uploads are keyed `resumes/{userId}/{ts}-{name}`
// where `name` comes from the multipart `filename` — client-controlled. A `/` (or `\`)
// in it would nest the object into a sub-"folder" that the account-deletion sweep never
// sees: that sweep does a NON-recursive `list(userId)` (immediate children only), so a
// nested object would survive an erasure while the cascade still reports success.
// Collapsing path separators here guarantees every résumé object is a direct child of
// `{userId}/`, which is exactly what `deleteStorageObjects` enumerates.

/**
 * Neutralize a client-supplied upload filename so it can never nest the Storage object:
 * take only the last path segment, strip control characters, and fall back to a default
 * if nothing usable remains. The result is guaranteed to contain no `/` or `\`.
 */
export function sanitizeUploadFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ""; // last segment → drops any directory parts
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "") // control chars (incl. NUL)
    .replace(/\.\.+/g, ".") // collapse traversal runs
    .trim();
  return cleaned || "resume.pdf";
}

const RESUME_NAME_MAX = 120;

/**
 * Build the flat, sweep-enumerable Storage key for an archived résumé upload. The name
 * part is limited to [A-Za-z0-9._-] like documentObjectPath's (each run of anything else
 * becomes one `_`, so an accent, a space, `#` or `%` cannot make Storage refuse the key),
 * keeps its extension and is never empty.
 */
export function resumeObjectPath(userId: string, filename: string): string {
  const safe = sanitizeUploadFilename(filename).replace(/[^A-Za-z0-9._-]+/g, "_");
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  const name = /[A-Za-z0-9]/.test(stem) ? `${stem}${ext}`.slice(-RESUME_NAME_MAX) : `resume${/[A-Za-z0-9]/.test(ext) ? ext : ".pdf"}`;
  return `${userId}/${Date.now()}-${name}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOCUMENT_NAME_MAX = 120;

/**
 * The Storage key for an uploaded document (plan Task 1.10): `{userId}/doc-{id}-{name}`,
 * a direct child of the user's folder (so the deletion sweep sees it), matching the
 * documents table's owner check. Generated server side only; the name is sanitized, cut
 * to 120 characters, and limited to [A-Za-z0-9._-] (each run of anything else becomes
 * one `_`), because Supabase Storage refuses keys with characters such as `#`, `?`, `%`
 * or `[`. The original name is kept in documents.filename, not in the key.
 */
export function documentObjectPath(userId: string, id: string, filename: string): string {
  if (!UUID_RE.test(userId) || !UUID_RE.test(id)) throw new Error("documentObjectPath: user and id must be uuids");
  const safe = sanitizeUploadFilename(filename).replace(/[^A-Za-z0-9._-]+/g, "_");
  const name = /[A-Za-z0-9]/.test(safe) ? safe.slice(-DOCUMENT_NAME_MAX) : "file";
  return `${userId}/doc-${id}-${name}`;
}
