// "/api/board-filters" is the anon-callable persistence endpoint — anonymous
// visitors must reach it to save their board filters to a cookie, so it must
// bypass the auth-redirect. "/api/jobs" serves the lazy per-job detail fields
// the public board fetches when a visitor opens a role. "/signup" and
// "/reset-password" are the account-lifecycle pages a logged-out visitor must
// reach; "/auth" already covers the /auth/confirm email-link callback (without
// it the confirmation link 307s to /login before the token is verified). Other
// /api routes stay private.
//
// Note "/reset-password" also matches "/reset-password/update" (the prefix rule).
// That page is reachable while logged out, but it enforces a valid recovery
// SESSION itself before allowing a password change, so exposing the path is safe.
const PUBLIC_PREFIXES = [
  "/", "/login", "/signup", "/auth", "/reset-password",
  "/api/board-filters", "/api/jobs",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Derive a safe "previous page" path from the request's Referer header. Only same-host referers
// are honored (anything else is an open-redirect risk), and the profile page itself is rejected so
// returning there can't bounce the user back into a loop.
export function internalPathFromReferer(
  referer: string | null | undefined,
  host: string,
  fallback = "/",
): string {
  if (!referer) return fallback;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return fallback;
  }
  if (url.host !== host) return fallback;
  if (url.pathname === "/profile" || url.pathname.startsWith("/profile/")) return fallback;
  return url.pathname + url.search;
}
