import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Email-link callback. The confirmation / recovery email points here with a
// token_hash + type; we exchange it for a session via verifyOtp, then forward to
// `next` (signup → /onboarding, recovery → /reset-password/update). A bad or
// expired token redirects to /login with a message rather than 500-ing. This path
// is allowlisted in lib/paths.ts (under /auth) so a logged-out visitor reaches it.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") ?? "/";
  // Only same-origin absolute paths are honored (open-redirect guard).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
    ? rawNext
    : "/";

  // Prefer the forwarded host so the redirect lands on the public origin behind a proxy.
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const origin = `${proto}://${host}`;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return Response.redirect(new URL(next, origin), 303);
  }
  // Re-clicking the same dead link fails identically, so point users at the recovery flow,
  // which mints a fresh link (verifyOtp on a recovery token also confirms the email).
  const msg = encodeURIComponent(
    "That link is invalid or has expired. Use ‘Forgot password?’ on the sign-in page to email yourself a fresh link.",
  );
  return Response.redirect(new URL(`/login?error=${msg}`, origin), 303);
}
