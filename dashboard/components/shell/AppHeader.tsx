"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/rolefit/AccountMenu";
import { AppNavMenu } from "./AppNavMenu";

export type AppRoute = "board" | "analytics" | "companies" | "profile" | "billing" | "admin";

const NAV = [
  { key: "board", href: "/", label: "Board" },
  { key: "analytics", href: "/analytics", label: "Analytics" },
  { key: "companies", href: "/companies", label: "Companies" },
] as const;

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
      <Link href="/" className="app-header__brand" aria-label="Rolefit board">
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
        {showNavigation && <AppNavMenu current={current} isAdmin={isAdmin} />}
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
