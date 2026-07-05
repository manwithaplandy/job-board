"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redeemInvite, releaseInvite } from "@/lib/invites";
import { safeAuthMessage } from "@/lib/safeError";
import { isDisposableEmail } from "@/lib/emailGuard";

const enc = (s: string) => encodeURIComponent(s);

// Sign-up server action (extracted from app/signup/page.tsx so the ordering contract is
// testable). ORDER IS LOAD-BEARING: the disposable-email guard runs BEFORE redeemInvite,
// which runs BEFORE any Supabase Auth call — a blocked email burns ZERO invite uses and
// makes no auth call. A test in app/actions/signup.test.ts locks this ordering.
export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("invite_code") ?? "");
  if (!email || !password) {
    redirect(`/signup?error=${enc("Email and password are required.")}`);
  }

  // Disposable-email guard (T7) runs BEFORE redeemInvite so a blocked email burns ZERO
  // invite uses and triggers no Supabase call. Generic copy — never reveal which
  // domain/list matched.
  if (isDisposableEmail(email)) {
    redirect(`/signup?error=${enc("Please use a permanent email address.")}`);
  }

  // Redeem the invite FIRST — an invalid/exhausted/expired code fails here, before
  // any Supabase Auth call is made (no wasted account, no email sent).
  const redeemed = await redeemInvite(code, email);
  if (!redeemed.ok) redirect(`/signup?error=${enc(redeemed.reason)}`);

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // The verification email links back here; /auth/confirm exchanges the token
    // then forwards to onboarding.
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/onboarding` },
  });
  if (error) {
    // Signup failed after the code was consumed — release it so the use isn't burned.
    await releaseInvite(code, email);
    // Map to a safe message (T5): allowlisted Supabase auth errors pass through as
    // friendly copy; anything else is logged and genericized — no internals in the URL.
    redirect(`/signup?error=${enc(safeAuthMessage("signup", error))}`);
  }
  redirect("/signup?sent=1");
}
