import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/FormControls";
import { Alert, EntryShell } from "@/components/ui/SystemStates";

export const dynamic = "force-dynamic";

async function sendReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  // No account enumeration: whatever happens, we show the same neutral message.
  // Only fire the email when an email was actually entered.
  if (email) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
    const supabase = await createClient();
    // Errors are intentionally swallowed so a caller can't distinguish
    // "email exists" from "email doesn't".
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password/update`,
    });
  }
  redirect("/reset-password?sent=1");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <EntryShell title="Check your email">
          <Alert tone="info">
            If that account exists, we&apos;ve sent a link to reset your password.
          </Alert>
          <a href="/login" className="rf-entry-link">Back to sign in</a>
      </EntryShell>
    );
  }

  return (
    <EntryShell title="Reset password" description="Enter your email and we’ll send you a link to set a new password.">
        <form action={sendReset} className="rf-entry-form">
          <TextField label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
        </form>
        <a href="/login" className="rf-entry-link">Back to sign in</a>
    </EntryShell>
  );
}
