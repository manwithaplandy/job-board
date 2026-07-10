"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PROFILE_LINKS = [
  ["Profile", "/profile"],
  ["Job preferences", "/profile/job-preferences"],
  ["Résumé & experience", "/profile/resume"],
  ["Application details", "/profile/application-details"],
  ["Application personalization", "/profile/application-personalization"],
  ["Advanced", "/profile/advanced"],
  ["Account", "/profile/account"],
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="settings-nav" aria-label="Profile settings">
      {PROFILE_LINKS.map(([label, href]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
