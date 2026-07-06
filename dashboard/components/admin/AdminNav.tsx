// Shared admin sub-nav (Tenants · Invites). Rendered ONLY inside already-
// isAdmin-gated /admin/* pages, so it advertises nothing to non-admins — the
// unadvertised-route convention holds: no public-header or AccountMenu link
// points at /admin/*. Server-component-compatible (plain anchors, no state).

export type AdminSection = "tenants" | "invites";

const LINKS: { section: AdminSection; label: string; href: string }[] = [
  { section: "tenants", label: "Tenants", href: "/admin/tenants" },
  { section: "invites", label: "Invites", href: "/admin/invites" },
];

export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav aria-label="Admin sections" style={{ display: "flex", gap: "6px", margin: "0 0 14px" }}>
      {LINKS.map(({ section, label, href }) => {
        const isActive = section === active;
        return (
          <a
            key={section}
            href={href}
            aria-current={isActive ? "page" : undefined}
            style={{
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              padding: "7px 12px",
              borderRadius: "9px",
              color: isActive ? "var(--text-primary)" : "var(--accent)",
              background: isActive ? "var(--bg-surface)" : "transparent",
              border: isActive ? "1px solid var(--border)" : "1px solid transparent",
            }}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
