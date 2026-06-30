// "/api/board-filters" is the anon-callable persistence endpoint — anonymous
// visitors must reach it to save their board filters to a cookie, so it must
// bypass the auth-redirect (other /api routes stay private).
const PUBLIC_PREFIXES = ["/", "/login", "/auth", "/api/board-filters"];

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
