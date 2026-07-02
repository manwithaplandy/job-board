import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              style={{
                border: "1px solid #e3e7ee",
                borderRadius: "10px",
                padding: "10px 13px",
                fontSize: "13px",
                outline: "none",
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
              name="password"
              type="password"
              required
              placeholder="••••••••"
              style={{
                border: "1px solid #e3e7ee",
                borderRadius: "10px",
                padding: "10px 13px",
                fontSize: "13px",
                outline: "none",
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
      </div>
    </main>
  );
}
