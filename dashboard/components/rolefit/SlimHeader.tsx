// Shared slim top-nav for the off-board pages (Analytics/Companies/Profile/Billing/Admin).
// The logo links back to the board; the content nav (Analytics/Companies) lets operators
// hop between subpages, and account management (Profile/Billing/Sign out) lives in the
// account menu on the far right. Reuses the board Header's logo + link tokens so the
// surfaces read as one app; the current content page is marked with a filled pill, while
// /profile, /billing, and /admin/* carry aria-current on their menu item instead.
//
// Async server component: it reads the viewer's email (locally-verified JWT) for the menu.
// Safe on every caller — every subpage (incl. the admin console) is authed, force-dynamic.

import Link from "next/link";
import { getUserClaims } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { AccountMenu } from "./AccountMenu";

type NavKey = "analytics" | "companies" | "profile" | "billing" | "admin";

const NAV: { key: NavKey; href: string; label: string }[] = [
  { key: "analytics", href: "/analytics", label: "Analytics" },
  { key: "companies", href: "/companies", label: "Companies" },
];

export async function SlimHeader({ current }: { current?: NavKey }) {
  const claims = await getUserClaims();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "13px 22px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Logo + brand → back to the board */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          textDecoration: "none",
          flex: "0 0 auto",
        }}
      >
        <div
          style={{
            width: "31px",
            height: "31px",
            borderRadius: "9px",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-accent-sm)",
          }}
        >
          <div
            style={{
              width: "11px",
              height: "11px",
              background: "var(--text-on-accent)",
              borderRadius: "3px",
              transform: "rotate(45deg)",
            }}
          />
        </div>
        <div style={{ fontWeight: 800, fontSize: "18.5px", letterSpacing: "-.4px", color: "var(--text-primary)" }}>
          Rolefit
        </div>
      </Link>

      {/* Cross-page nav — the current page is marked (filled pill), others are plain links */}
      <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
        {NAV.map((n) => {
          const active = current === n.key;
          return (
            <a
              key={n.key}
              href={n.href}
              aria-current={active ? "page" : undefined}
              style={{
                fontWeight: 700,
                fontSize: "13px",
                textDecoration: "none",
                padding: "9px 12px",
                borderRadius: "9px",
                color: active ? "var(--text-primary)" : "var(--accent)",
                background: active ? "var(--accent-bg)" : "transparent",
              }}
            >
              {n.label}
            </a>
          );
        })}
      </nav>

      {/* Account menu (Profile / Billing / Admin / Sign out) */}
      <AccountMenu
        email={claims?.email ?? null}
        isAdmin={isAdmin(claims)}
        current={current === "profile" || current === "billing" || current === "admin" ? current : undefined}
      />
    </header>
  );
}
