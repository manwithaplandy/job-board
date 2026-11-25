"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/rolefit/AccountMenu";
import { AppNavMenu } from "./AppNavMenu";

export type AppRoute =
  | "agent"
  | "shortlist"
  | "applications"
  | "looking-for"
  | "documents"
  | "analytics"
  // Board and Companies stay as routes until the phase 3 cutover but are not in the
  // primary nav: the brand links to the board, and "What I'm looking for" links to
  // Companies (where include/exclude moves at cutover, spec 8.3).
  | "board"
  | "companies"
  | "profile"
  | "billing"
  | "admin";

export interface NavItem {
  key: AppRoute;
  href: string;
  label: string;
}

// The primary destinations (plan Task 1.23), shared by the desktop nav and the mobile
// menu so the two cannot drift.
const NAV: readonly NavItem[] = [
  { key: "agent", href: "/agent", label: "Agent" },
  { key: "shortlist", href: "/shortlist", label: "Shortlist" },
  { key: "applications", href: "/applications", label: "Applications" },
  { key: "looking-for", href: "/looking-for", label: "Looking for" },
  { key: "documents", href: "/documents", label: "Documents" },
  { key: "analytics", href: "/analytics", label: "Analytics" },
];

export interface AppHeaderProps {
  current?: AppRoute;
  email: string | null;
  isAdmin?: boolean;
  center?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  showAccount?: boolean;
  showNavigation?: boolean;
}

export function AppHeader({ current, email, isAdmin = false, center, actions, compact = false, showAccount = true, showNavigation = true }: AppHeaderProps) {
  return (
    <header className={["app-header", compact && "app-header--compact"].filter(Boolean).join(" ")}>
      <Link href="/" className="app-header__brand" aria-label="Rolefit board" aria-current={current === "board" ? "page" : undefined}>
        <span className="app-header__logo" aria-hidden="true"><span /></span>
        <span className="app-header__wordmark">Rolefit</span>
      </Link>

      {showNavigation && <nav className="app-header__desktop-nav" aria-label="Primary">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current === item.key ? "page" : undefined}
            className="app-header__nav-link rf-focusable"
          >
            {item.label}
          </Link>
        ))}
      </nav>}

      {center && <div className="app-header__center">{center}</div>}
      <div className="app-header__actions">
        {actions}
        {showNavigation && <AppNavMenu items={NAV} current={current} />}
        {showAccount && (
          <AccountMenu
            email={email}
            isAdmin={isAdmin}
            current={current === "profile" || current === "billing" || current === "admin" ? current : undefined}
          />
        )}
      </div>
    </header>
  );
}
