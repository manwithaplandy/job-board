import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/ui/SubmitButton";

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
  if (error) redirect(`/reset-password/update?error=${enc(error.message)}`);
  redirect("/");
}

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
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 18px", fontSize: "20px", fontWeight: 800, color: "#161d29" }}>
          Set a new password
        </h1>
        <form action={updatePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={labelStyle}>
            New password
            <input className="rf-focusable" name="password" type="password"
              autoComplete="new-password" required minLength={8} placeholder="••••••••"
              style={inputStyle} />
          </label>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: "12.5px", color: "#b25a36", fontWeight: 600 }}>
              {error}
            </p>
          )}
          <SubmitButton
            pendingLabel="Saving…"
            style={{
              borderRadius: "10px", padding: "11px 20px", fontSize: "13.5px",
              boxShadow: "0 3px 10px rgba(59,111,212,.26)", marginTop: "4px",
            }}
          >
            Update password
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
