import { SubmitButton } from "@/components/ui/SubmitButton";
import { SupportLink, supportEmail } from "@/components/SupportLink";
import { signUp } from "@/app/actions/signup";

export const dynamic = "force-dynamic";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#f4f6fa",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const cardStyle: React.CSSProperties = {
  width: "360px", maxWidth: "calc(100vw - 32px)", background: "#fff",
  borderRadius: "18px", border: "1px solid #e7eaf0",
  boxShadow: "0 12px 40px rgba(15,22,35,.08)", padding: "32px",
};
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "6px",
  fontSize: "13px", fontWeight: 600, color: "#5b6472",
};
const inputStyle: React.CSSProperties = {
  border: "1px solid #e3e7ee", borderRadius: "10px", padding: "10px 13px",
  fontSize: "13px", fontFamily: "inherit",
};
const linkRowStyle: React.CSSProperties = {
  marginTop: "16px", fontSize: "12.5px", color: "#6b7480", textAlign: "center",
};
const linkStyle: React.CSSProperties = {
  color: "#3b6fd4", fontWeight: 600, textDecoration: "none",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 800, color: "#161d29" }}>
            Check your email
          </h1>
          <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: "#5b6472" }}>
            We sent a confirmation link to your inbox. Click it to verify your
            account and finish setting up your board.
          </p>
          <div style={linkRowStyle}>
            <a href="/login" style={linkStyle}>Back to sign in</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 20px", fontSize: "20px", fontWeight: 800, color: "#161d29" }}>
          Create account
        </h1>
        <form action={signUp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={labelStyle}>
            Email
            <input className="rf-focusable" name="email" type="email" autoComplete="email"
              required placeholder="you@example.com" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Password
            <input className="rf-focusable" name="password" type="password"
              autoComplete="new-password" required minLength={8} placeholder="••••••••"
              style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Invite code
            <input className="rf-focusable" name="invite_code" required
              placeholder="Your invite code" style={inputStyle} />
            <span style={{ fontSize: "11.5px", fontWeight: 500, lineHeight: 1.5, color: "#8b94a3" }}>
              Rolefit is in invite-only beta — an invite code is required.
            </span>
          </label>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: "12.5px", color: "#b25a36", fontWeight: 600 }}>
              {error}
            </p>
          )}
          <p style={{ margin: "2px 0 0", fontSize: "11.5px", lineHeight: 1.5, color: "#8b94a3" }}>
            By creating an account you agree to the{" "}
            <a href="/terms" style={linkStyle}>Terms of Service</a> and{" "}
            <a href="/privacy" style={linkStyle}>Privacy Policy</a>.
          </p>
          <SubmitButton
            pendingLabel="Creating account…"
            style={{
              borderRadius: "10px", padding: "11px 20px", fontSize: "13.5px",
              boxShadow: "0 3px 10px rgba(59,111,212,.26)", marginTop: "4px",
            }}
          >
            Create account
          </SubmitButton>
        </form>
        <div style={linkRowStyle}>
          Already have an account?{" "}
          <a href="/login" style={linkStyle}>Sign in</a>
        </div>
        <div style={{ ...linkRowStyle, marginTop: "10px", fontSize: "11.5px" }}>
          <a href="/terms" style={linkStyle}>Terms</a>
          {" · "}
          <a href="/privacy" style={linkStyle}>Privacy</a>
          {supportEmail() && (
            <>
              {" · "}
              <SupportLink label="Support" />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
