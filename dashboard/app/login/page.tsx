import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/FormControls";
import { Alert, EntryShell } from "@/components/ui/SystemStates";
import { safeAuthMessage } from "@/lib/safeError";
import { SupportLink, supportEmail } from "@/components/SupportLink";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(safeAuthMessage("login", error))}`);

  // Adopt anonymous cookie filters into the account (best-effort, UPDATE-only).
  const store = await cookies();
  const raw = store.get("board_filters")?.value;
  if (raw && data.user) {
    try {
      await saveBoardFilters(data.user.id, parseBoardFilters(raw));
    } catch (e) {
      console.error("filter adoption failed", e);
    }
    store.delete("board_filters");
  }

  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const { error, deleted } = await searchParams;
  return (
    <EntryShell
      title="Sign in"
      footer={<><a href="/terms">Terms</a>{" · "}<a href="/privacy">Privacy</a>{supportEmail() && <>{" · "}<SupportLink label="Support" /></>}</>}
    >
        {deleted && (
          <Alert tone="success">
            Your account and data have been permanently deleted.
          </Alert>
        )}
        <form action={signIn} className="rf-entry-form">
          <TextField label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          {error && <Alert tone="danger">{error}</Alert>}
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </form>
        <div className="rf-entry-links">
          <a href="/signup" className="rf-entry-link rf-focusable">Create account</a>
          <a href="/reset-password" className="rf-entry-link rf-focusable">Forgot password?</a>
        </div>
    </EntryShell>
  );
}
