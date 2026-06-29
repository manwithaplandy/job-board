import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveBoardFilters } from "@/lib/queries";
import { parseBoardFilters } from "@/lib/rolefit/boardFilters";

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
    <main className="mx-auto mt-24 max-w-sm px-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <form action={signIn} className="mt-4 flex flex-col gap-3">
        <input name="email" type="email" required placeholder="email"
          className="rounded border px-2 py-1 text-sm" />
        <input name="password" type="password" required placeholder="password"
          className="rounded border px-2 py-1 text-sm" />
        <button type="submit"
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">
          Sign in
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
