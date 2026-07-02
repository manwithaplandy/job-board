// Resolve the public "apply" URL for a job from its ATS + stored url. The
// pipeline stores different url shapes per provider (see job_discovery/adapters):
//   greenhouse      → absolute_url (the public posting, apply lives on the same page)
//   ashby           → jobUrl / applyUrl (already the posting)
//   lever           → hostedUrl (the posting page; the form is at `${hostedUrl}/apply`)
//   workable        → application_url (the hosted apply page)
//   smartrecruiters → applyUrl / postingUrl (the public apply/posting page)
//   workday         → externalUrl (the public job page)
// All but lever already store a url that links straight to the posting/apply page,
// so they pass through unchanged. Pure and total: never throws, and returns null
// when there is no usable url.

function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : null;
  } catch { return null; }
}

export function applyUrl(
  ats: string | null | undefined,
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const safe = safeHttpUrl(trimmed);
  if (!safe) return null;

  switch ((ats ?? "").toLowerCase()) {
    case "lever":
      return leverApplyUrl(safe);
    case "greenhouse":
    case "ashby":
    case "workable":
    case "smartrecruiters":
    case "workday":
    default:
      return safe;
  }
}

// Lever's apply form is the posting URL with `/apply` appended. Strip any
// trailing slash and avoid doubling up when the url already ends in /apply.
function leverApplyUrl(url: string): string {
  const base = url.replace(/\/+$/, "");
  return /\/apply$/i.test(base) ? base : `${base}/apply`;
}
