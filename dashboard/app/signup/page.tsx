import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/FormControls";
import { Alert, EntryShell } from "@/components/ui/SystemStates";
import { SupportLink, supportEmail } from "@/components/SupportLink";
import { signUp } from "@/app/actions/signup";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <EntryShell title="Check your email">
          <Alert tone="success">
            We sent a confirmation link to your inbox. Click it to verify your
            account and finish setting up your board.
          </Alert>
          <a href="/login" className="rf-entry-link rf-focusable">Back to sign in</a>
      </EntryShell>
    );
  }

  return (
    <EntryShell
      title="Create account"
      footer={<><a href="/terms">Terms</a>{" · "}<a href="/privacy">Privacy</a>{supportEmail() && <>{" · "}<SupportLink label="Support" /></>}</>}
    >
        <form action={signUp} className="rf-entry-form">
          <TextField label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          <TextField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" />
          <TextField label="Invite code" name="invite_code" required placeholder="Your invite code" description="Rolefit is in invite-only beta — an invite code is required." />
          {error && <Alert tone="danger">{error}</Alert>}
          <p className="rf-entry-consent">
            By creating an account you agree to the{" "}
            <a href="/terms">Terms of Service</a> and{" "}
            <a href="/privacy">Privacy Policy</a>.
          </p>
          <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
        </form>
        <div className="rf-entry-footer">
          Already have an account?{" "}
          <a href="/login">Sign in</a>
        </div>
    </EntryShell>
  );
}
