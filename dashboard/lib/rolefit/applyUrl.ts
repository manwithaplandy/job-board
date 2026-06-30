// Resolve the public "apply" URL for a job from its ATS + stored url. The
// pipeline stores different url shapes per provider (see job_discovery/adapters):
//   greenhouse → absolute_url (the public posting, apply lives on the same page)
//   ashby      → jobUrl / applyUrl (already the posting)
//   lever      → hostedUrl (the posting page; the form is at `${hostedUrl}/apply`)
// Pure and total: never throws, and returns null when there is no usable url.
export function applyUrl(
  ats: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  switch ((ats ?? "").toLowerCase()) {
    case "lever":
      return leverApplyUrl(trimmed);
    case "greenhouse":
    case "ashby":
    default:
      return trimmed;
  }
}

// Lever's apply form is the posting URL with `/apply` appended. Strip any
// trailing slash and avoid doubling up when the url already ends in /apply.
function leverApplyUrl(url: string): string {
  const base = url.replace(/\/+$/, "");
  return /\/apply$/i.test(base) ? base : `${base}/apply`;
}
