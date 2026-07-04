import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { SubmitButton } from "@/components/ui/SubmitButton";
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
    <main
      style={{
        minHeight: "100vh",
        background: "#f4f6fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          background: "#fff",
          borderRadius: "18px",
          border: "1px solid #e7eaf0",
          boxShadow: "0 12px 40px rgba(15,22,35,.08)",
          padding: "32px",
        }}
      >
        <h1
          style={{
            margin: "0 0 20px",
            fontSize: "20px",
            fontWeight: 800,
            color: "#161d29",
          }}
        >
          Sign in
        </h1>
        {deleted && (
          <p
            role="status"
            style={{
              margin: "0 0 16px", fontSize: "12.5px", lineHeight: 1.5,
              color: "#2f6f4f", fontWeight: 600,
            }}
          >
            Your account and data have been permanently deleted.
          </p>
        )}
        <form
          action={signIn}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#5b6472",
            }}
          >
            Email
            <input
              className="rf-focusable"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              style={{
                border: "1px solid #e3e7ee",
                borderRadius: "10px",
                padding: "10px 13px",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#5b6472",
            }}
          >
            Password
            <input
              className="rf-focusable"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              style={{
                border: "1px solid #e3e7ee",
                borderRadius: "10px",
                padding: "10px 13px",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </label>
          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontSize: "12.5px",
                color: "#b25a36",
                fontWeight: 600,
              }}
            >
              {error}
            </p>
          )}
          <SubmitButton
            pendingLabel="Signing in…"
            style={{
              borderRadius: "10px",
              padding: "11px 20px",
              fontSize: "13.5px",
              boxShadow: "0 3px 10px rgba(59,111,212,.26)",
              marginTop: "4px",
            }}
          >
            Sign in
          </SubmitButton>
        </form>
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12.5px",
            color: "#6b7480",
          }}
        >
          <a href="/signup" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
            Create account
          </a>
          <a href="/reset-password" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>
            Forgot password?
          </a>
        </div>
        <div
          style={{
            marginTop: "12px", fontSize: "11.5px", color: "#8b94a3", textAlign: "center",
          }}
        >
          <a href="/terms" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>Terms</a>
          {" · "}
          <a href="/privacy" style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none" }}>Privacy</a>
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
