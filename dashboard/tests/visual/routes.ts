export type VisualAccess = "public" | "authenticated";
export type VisualShell = "none" | "app" | "board" | "entry";
export type VisualFamily = "entry" | "legal" | "system-states" | "board" | "companies" | "analytics" | "billing" | "profile" | "admin" | "onboarding";

export interface VisualRoute {
  id: string;
  path: string;
  access: VisualAccess;
  family: VisualFamily;
  state: string;
  shell: VisualShell;
  source?: string;
  fixtureFor?: VisualFamily;
  authState?: "normal" | "onboarding";
}

const fixture = (family: VisualFamily, state: string): VisualRoute => ({
  id: `${family}-${state}-fixture`, path: `/ui-gallery/states/${family}-${state}`,
  access: "public", family, state, shell: "none", fixtureFor: family,
});

/** Canonical route/state inventory; every entry runs in both themes at both viewports. */
export const VISUAL_ROUTES: VisualRoute[] = [
  { id: "login-default", path: "/login", access: "public", family: "entry", state: "default", shell: "entry", source: "app/login/page.tsx" },
  { id: "login-error", path: "/login?error=Something%20went%20wrong.%20Please%20try%20again.", access: "public", family: "entry", state: "error", shell: "entry", source: "app/login/page.tsx" },
  { id: "signup-default", path: "/signup", access: "public", family: "entry", state: "default", shell: "entry", source: "app/signup/page.tsx" },
  { id: "reset-password", path: "/reset-password", access: "public", family: "entry", state: "reset", shell: "entry", source: "app/reset-password/page.tsx" },
  { id: "reset-password-update", path: "/reset-password/update", access: "authenticated", family: "entry", state: "update", shell: "entry", source: "app/reset-password/update/page.tsx", authState: "normal" },
  { id: "privacy", path: "/privacy", access: "public", family: "legal", state: "default", shell: "none", source: "app/privacy/page.tsx" },
  { id: "terms", path: "/terms", access: "public", family: "legal", state: "default", shell: "none", source: "app/terms/page.tsx" },
  { id: "primitive-and-state-gallery", path: "/ui-gallery", access: "public", family: "system-states", state: "interaction-contracts", shell: "none", source: "app/ui-gallery/page.tsx" },
  { id: "board-default", path: "/", access: "authenticated", family: "board", state: "default", shell: "board", source: "components/rolefit/RolefitBoard.tsx" },
  // The ISR twin of the anon board (proxy rewrites anon GET / here) — same RolefitBoard
  // render as board-default, public access, no operator strip.
  { id: "board-public-isr", path: "/board", access: "public", family: "board", state: "default", shell: "board", source: "app/board/page.tsx" },
  { id: "companies-default", path: "/companies", access: "authenticated", family: "companies", state: "default", shell: "app", source: "app/companies/page.tsx" },
  { id: "analytics-default", path: "/analytics", access: "authenticated", family: "analytics", state: "default", shell: "app", source: "app/analytics/page.tsx" },
  { id: "billing-default", path: "/billing", access: "authenticated", family: "billing", state: "default", shell: "app", source: "app/billing/page.tsx" },
  { id: "profile-hub", path: "/profile", access: "authenticated", family: "profile", state: "default", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-job-preferences", path: "/profile/job-preferences", access: "authenticated", family: "profile", state: "job-preferences", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-resume", path: "/profile/resume", access: "authenticated", family: "profile", state: "resume", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-application-details", path: "/profile/application-details", access: "authenticated", family: "profile", state: "application-details", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-personalization", path: "/profile/application-personalization", access: "authenticated", family: "profile", state: "personalization", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-advanced", path: "/profile/advanced", access: "authenticated", family: "profile", state: "advanced", shell: "app", source: "app/profile/layout.tsx" },
  { id: "profile-account", path: "/profile/account", access: "authenticated", family: "profile", state: "account", shell: "app", source: "app/profile/layout.tsx" },
  { id: "admin-tenants", path: "/admin/tenants", access: "authenticated", family: "admin", state: "default", shell: "app", source: "app/admin/tenants/page.tsx" },
  { id: "admin-invites", path: "/admin/invites", access: "authenticated", family: "admin", state: "invites", shell: "app", source: "app/admin/invites/page.tsx" },
  { id: "onboarding", path: "/onboarding", access: "authenticated", family: "onboarding", state: "default", shell: "entry", source: "app/onboarding/page.tsx", authState: "onboarding" },
  ...["selected", "filter-empty", "rejected", "applied", "loading", "error-retry", "generation", "application-package"].map((state) => fixture("board", state)),
  fixture("companies", "empty"), fixture("analytics", "data-viz"), fixture("billing", "current"),
  fixture("profile", "error"), fixture("profile", "disabled"), fixture("profile", "destructive"),
  fixture("admin", "empty"), fixture("system-states", "focus"), fixture("system-states", "destructive"),
];
