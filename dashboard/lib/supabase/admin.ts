import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase admin client (T3). This key BYPASSES RLS and can administer
// auth users — it must NEVER reach the browser. Used ONLY server-side for
// auth.admin.deleteUser during account deletion.
//
// Lazy + call-time validation: importing this module never requires the key (so a
// build / an unrelated route that transitively imports it doesn't crash). The FIRST
// call throws loudly if SUPABASE_SERVICE_ROLE_KEY (or the URL) is unset, rather than
// silently constructing a broken client.
let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for account deletion (auth.admin). " +
        "Add it to the server environment (never expose it to the browser).",
    );
  }
  _admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
