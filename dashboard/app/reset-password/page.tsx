import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";

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

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "var(--bg-page)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const cardStyle: React.CSSProperties = {
  width: "360px", maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface)",
  borderRadius: "18px", border: "1px solid var(--border)",
  boxShadow: "0 12px 40px rgba(15,22,35,.08)", padding: "32px",
};
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "6px",
  fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: "10px", padding: "10px 13px",
  fontSize: "13px", fontFamily: "inherit",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            Check your email
          </h1>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
            If that account exists, we&apos;ve sent a link to reset your password.
          </p>
          <div style={{ marginTop: "16px", fontSize: "12.5px", textAlign: "center" }}>
            <a href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
              Back to sign in
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
          Reset password
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        <form action={sendReset} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={labelStyle}>
            Email
            <input className="rf-focusable" name="email" type="email" autoComplete="email"
              required placeholder="you@example.com" style={inputStyle} />
          </label>
          <SubmitButton
            pendingLabel="Sending…"
            style={{
              borderRadius: "10px", padding: "11px 20px", fontSize: "13.5px",
              boxShadow: "var(--shadow-accent-md)", marginTop: "4px",
            }}
          >
            Send reset link
          </SubmitButton>
        </form>
        <div style={{ marginTop: "16px", fontSize: "12.5px", color: "var(--text-secondary)", textAlign: "center" }}>
          <a href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            Back to sign in
          </a>
        </div>
      </div>
    </main>
  );
}
