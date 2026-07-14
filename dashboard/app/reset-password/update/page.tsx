import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/FormControls";
import { Alert, EntryShell } from "@/components/ui/SystemStates";
import { safeAuthMessage } from "@/lib/safeError";

export const dynamic = "force-dynamic";

const enc = (s: string) => encodeURIComponent(s);

async function updatePassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect(`/reset-password/update?error=${enc("Password must be at least 8 characters.")}`);
  }
  const supabase = await createClient();
  // Must have the recovery session established by /auth/confirm (verifyOtp).
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect(`/login?error=${enc("Your reset link expired. Request a new one.")}`);
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password/update?error=${enc(safeAuthMessage("reset-password", error))}`);
  redirect("/");
}

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Gate the page on a session: the recovery session from the email link (or an
  // already-signed-in user changing their password). No session → back to login.
  const userId = await getUserId();
  if (!userId) redirect(`/login?error=${enc("Open the reset link from your email to continue.")}`);

  const { error } = await searchParams;
  return (
    <EntryShell title="Set a new password">
        <form action={updatePassword} className="rf-entry-form">
          <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" />
          {error && <Alert tone="danger">{error}</Alert>}
          <SubmitButton pendingLabel="Saving…">Update password</SubmitButton>
        </form>
    </EntryShell>
  );
}
