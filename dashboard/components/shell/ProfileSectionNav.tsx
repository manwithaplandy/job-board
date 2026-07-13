"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export const PROFILE_SECTIONS = [
  ["Profile", "/profile"],
  ["Job preferences", "/profile/job-preferences"],
  ["Résumé & experience", "/profile/resume"],
  ["Application details", "/profile/application-details"],
  ["Application personalization", "/profile/application-personalization"],
  ["Advanced", "/profile/advanced"],
  ["Account", "/profile/account"],
] as const;

export function ProfileSectionNav() {
  const pathname = usePathname();
  const router = useRouter();
  const current = PROFILE_SECTIONS.some(([, href]) => href === pathname) ? pathname : "/profile";

  return (
    <div className="profile-section-nav">
      <nav className="settings-nav profile-section-nav__desktop" aria-label="Profile settings">
        {PROFILE_SECTIONS.map(([label, href]) => (
          <Link className="settings-nav-link profile-section-nav__link rf-focusable" key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <label className="profile-section-nav__mobile">
        <span>Profile section</span>
        <select aria-label="Profile section" value={current} onChange={(event) => router.push(event.target.value)}>
          {PROFILE_SECTIONS.map(([label, href]) => <option key={href} value={href}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
