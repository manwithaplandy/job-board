// Error-surface sanitization (T5, spec subsystem F: "error surfaces that don't leak
// internals"). Raw Error messages can carry postgres/storage/network internals (host
// names, SQL, stack fragments). NEVER put an unclassified error string into a
// Response.json body, a redirect query param, or form state. Instead: log the FULL
// error server-side (console.error, so it lands in Vercel logs), and return a GENERIC,
// user-safe message.
//
// Auth flows are the one place where a few specific Supabase messages ARE safe (and
// helpful) to show verbatim — "email already registered", "weak password". Those go
// through an explicit ALLOWLIST; anything not on it degrades to generic.

export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Log the full error server-side and return a generic, user-safe message. Use at every
 * boundary where an error would otherwise reach a client (route body, redirect param,
 * form state). `context` is a short tag for the log line so incidents are locatable.
 */
export function safeErrorMessage(
  context: string,
  e: unknown,
  generic: string = GENERIC_MESSAGE,
): string {
  console.error(`[${context}]`, e);
  return generic;
}

// Known-safe Supabase Auth messages. Each pattern maps the raw message to friendly,
// leak-free copy. Order doesn't matter (patterns are disjoint in practice).
const AUTH_SAFE_PATTERNS: { match: RegExp; message: string }[] = [
  {
    match: /already registered|already been registered|user already exists|already exists/i,
    message: "An account with this email already exists. Try signing in.",
  },
  {
    match: /weak password|password should be at least|password.*at least \d|should be at least \d+ characters/i,
    message: "That password is too weak — use at least 8 characters.",
  },
  {
    match: /invalid login credentials/i,
    message: "Incorrect email or password.",
  },
  {
    match: /email not confirmed/i,
    message: "Please confirm your email address before signing in.",
  },
  {
    match: /email rate limit|rate limit|too many requests/i,
    message: "Too many attempts. Please wait a moment and try again.",
  },
  {
    match: /unable to validate email address|invalid email|email address.*invalid/i,
    message: "Please enter a valid email address.",
  },
  {
    match: /signups? not allowed|signup is disabled/i,
    message: "Sign-ups are not currently open.",
  },
];

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "";
}

/**
 * Map an auth error to a user-facing message: an allowlisted Supabase message passes
 * through as friendly copy; anything else is logged in full and returns generic. Use
 * for signup/login/reset flows only — general routes use safeErrorMessage.
 */
export function safeAuthMessage(
  context: string,
  e: unknown,
  generic: string = GENERIC_MESSAGE,
): string {
  const raw = rawMessage(e);
  for (const p of AUTH_SAFE_PATTERNS) {
    if (p.match.test(raw)) return p.message;
  }
  // Not a recognized, safe auth message → treat as internal: log and genericize.
  console.error(`[${context}]`, e);
  return generic;
}
