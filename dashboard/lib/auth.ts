import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally (no GoTrue round-trip on warm
  // instances); the user id is the `sub` claim. See lib/supabase/middleware.ts
  // for the full rationale and tradeoff.
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}
