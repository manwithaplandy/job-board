"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getUserClaims } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "@/lib/accountDeletion";
import { safeErrorMessage } from "@/lib/safeError";

export type DeleteAccountState = { error: string } | null;

// Type-to-confirm gate: the user must type DELETE (case-insensitive) or their own email
// exactly. This is checked against the CALLER's own verified claims — the action never
// accepts a target user id, so it can only ever delete the caller's own account.
function confirmationMatches(input: string, email: string | null): boolean {
  const v = input.trim();
  if (v.toUpperCase() === "DELETE") return true;
  if (email && v.toLowerCase() === email.trim().toLowerCase()) return true;
  return false;
}

export async function deleteMyAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  try {
    const claims = await getUserClaims();
    if (!claims) redirect("/login");
    // Derive the id to delete ONLY from the verified session — never from the form.
    const userId = claims.id;
    const email = claims.email;

    const confirm = String(formData.get("confirm") ?? "");
    if (!confirmationMatches(confirm, email)) {
      return { error: 'Type DELETE (or your email) to confirm.' };
    }

    await deleteAccount(userId, email);

    // Local session teardown after the account is gone (best-effort — the auth user is
    // already deleted server-side, so a signOut hiccup doesn't leave a usable session).
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("account deletion: signOut failed (account already deleted)", e);
    }
  } catch (e) {
    unstable_rethrow(e);
    return { error: safeErrorMessage("account.delete", e, "Account deletion failed. Please try again or contact support.") };
  }
  redirect("/login?deleted=1");
}
