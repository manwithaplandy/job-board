// Support/contact affordance (spec subsystem F). The address comes from
// NEXT_PUBLIC_SUPPORT_EMAIL (public — inlined at build), falling back to the operator's
// address when the env is unset, so the contact affordance ALWAYS renders — the legal
// pages' Contact sections and the error page must never be empty (prod does not set the
// env today). Usable in both server and client trees (no directive), so the error page
// (client) and the legal pages / auth footers (server) share it.
//
// The literal `process.env.NEXT_PUBLIC_SUPPORT_EMAIL` access is required for Next to
// inline it — do not refactor to a dynamic `process.env[...]` lookup.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const FALLBACK_SUPPORT_EMAIL = "andrewrmalvani@gmail.com";

export function supportEmail(): string {
  return SUPPORT_EMAIL && SUPPORT_EMAIL.trim() ? SUPPORT_EMAIL.trim() : FALLBACK_SUPPORT_EMAIL;
}

/** A mailto link to support (NEXT_PUBLIC_SUPPORT_EMAIL, or the operator fallback). */
export function SupportLink({
  label,
  subject,
  style,
}: {
  label?: string;
  subject?: string;
  style?: React.CSSProperties;
}) {
  const email = supportEmail();
  const href = subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`;
  return (
    <a
      href={href}
      style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none", ...style }}
    >
      {label ?? email}
    </a>
  );
}
