// Support/contact affordance (spec subsystem F). The address comes from
// NEXT_PUBLIC_SUPPORT_EMAIL (public — inlined at build). When unset the component
// renders NOTHING (graceful degradation), so a missing env never shows a broken
// "mailto:" or an empty link. Usable in both server and client trees (no directive),
// so the error page (client) and the legal pages / auth footers (server) share it.
//
// The literal `process.env.NEXT_PUBLIC_SUPPORT_EMAIL` access is required for Next to
// inline it — do not refactor to a dynamic `process.env[...]` lookup.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export function supportEmail(): string | null {
  return SUPPORT_EMAIL && SUPPORT_EMAIL.trim() ? SUPPORT_EMAIL.trim() : null;
}

/** A mailto link to support, or null when NEXT_PUBLIC_SUPPORT_EMAIL is unset. */
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
  if (!email) return null;
  const href = subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`;
  return (
    <a
      href={href}
      style={{ color: "#3b6fd4", fontWeight: 600, textDecoration: "none", ...style }}
    >
      {label ?? email}
    </a>
  );
}
