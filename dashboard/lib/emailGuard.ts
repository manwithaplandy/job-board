import { DISPOSABLE_EMAIL_DOMAINS } from "@/lib/disposableEmailDomains";

// Disposable-email guard (T7, spec G). Blocks throwaway domains at signup BEFORE an
// invite is consumed or a Supabase account is created, so a blocked email never burns
// an invite use. The check is a lowercase exact-or-subdomain Set lookup (a.mailinator.com
// matches mailinator.com), never a regex scan. Malformed input returns false and is left
// to the existing email validation — this guard's only job is domain classification.

/** True iff the address's domain (or a parent domain) is a known disposable provider. */
export function isDisposableEmail(email: string): boolean {
  if (typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  // No "@", empty local part, or empty domain → malformed; not our call to reject.
  if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || domain.includes(" ") || domain.includes("@")) return false;

  const labels = domain.split(".");
  if (labels.some((l) => l === "")) return false; // leading/trailing/double dots

  // Check the full domain and every parent suffix except the bare TLD, so a subdomain
  // (a.mailinator.com) matches a listed registrable domain (mailinator.com).
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return false;
}
