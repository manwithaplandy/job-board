// Admin gate for operator-only surfaces (T8, spec G: per-tenant monitoring). Membership
// is the ADMIN_EMAILS env: comma-separated, case-insensitive, whitespace-tolerant. It is
// compared against the VERIFIED JWT email (lib/auth getUserClaims), never client input.
// FAIL CLOSED: an unset/blank ADMIN_EMAILS means NO admins — nobody reaches /admin/*.

export function adminEmails(): ReadonlySet<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/** True iff the verified claims carry an email listed in ADMIN_EMAILS. */
export function isAdmin(claims: { email?: string | null } | null | undefined): boolean {
  const email = claims?.email?.trim().toLowerCase();
  if (!email) return false;
  const allow = adminEmails();
  if (allow.size === 0) return false; // fail closed — no env ⇒ no admins
  return allow.has(email);
}
