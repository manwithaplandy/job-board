import { Tabs } from "@/components/ui/Navigation";

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
  return <Tabs className="rf-admin-nav" label="Admin sections" items={LINKS.map(({ section, label, href }) => ({ label, href, active: section === active }))} />;
}
