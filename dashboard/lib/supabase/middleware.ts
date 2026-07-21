import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/paths";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Fast-path: no auth cookie + public path → skip session work entirely.
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith("sb-"));
  if (!hasAuthCookie && isPublicPath(request.nextUrl.pathname)) {
    // Anon board: serve the edge-cached ISR twin (app/board) instead of the dynamic
    // 500-row SSR. Rewrite, not redirect — the visitor's URL stays "/".
    if (request.nextUrl.pathname === "/") {
      return NextResponse.rewrite(new URL("/board", request.url));
    }
    return NextResponse.next();
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the access-token JWT LOCALLY (WebCrypto) using the
  // project's ES256 asymmetric signing key, instead of getUser()'s network
  // round-trip to GoTrue in us-west-1 on every request. The JWKS is fetched
  // once per process and cached, so warm requests do zero auth network I/O.
  // It still calls getSession() underneath, so an expired token is refreshed
  // and the rotated cookies are written (the setAll callback above), preserving
  // session refresh. Tradeoff: a server-side-revoked token stays valid until it
  // expires (<=1h) rather than being caught immediately — acceptable for this
  // single-tenant board.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // The ISR twin renders the ANON board — an authed visitor landing on it directly
  // (typed URL, stale link) belongs on their dynamic board at /.
  if (claims && request.nextUrl.pathname === "/board") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}
