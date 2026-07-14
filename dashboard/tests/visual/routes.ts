export type VisualAccess = "public" | "authenticated";

export interface VisualRoute {
  id: string;
  path: string;
  access: VisualAccess;
  family: "entry" | "legal" | "system-states" | "board" | "companies" | "analytics" | "billing" | "profile" | "admin" | "onboarding";
}

/**
 * Canonical route/state inventory. Every entry is exercised in light and dark at
 * 1440x1000 and 390x844. Authenticated entries run when VISUAL_AUTH_STATE_JSON is
 * supplied; public routes remain an always-on CI screenshot gate.
 */
export const VISUAL_ROUTES: VisualRoute[] = [
  { id: "login-default", path: "/login", access: "public", family: "entry" },
  { id: "login-error", path: "/login?error=Something%20went%20wrong.%20Please%20try%20again.", access: "public", family: "entry" },
  { id: "signup-default", path: "/signup", access: "public", family: "entry" },
  { id: "reset-password", path: "/reset-password", access: "public", family: "entry" },
  { id: "privacy", path: "/privacy", access: "public", family: "legal" },
  { id: "terms", path: "/terms", access: "public", family: "legal" },
  { id: "primitive-and-state-gallery", path: "/ui-gallery", access: "public", family: "system-states" },
  { id: "board-default", path: "/", access: "authenticated", family: "board" },
  { id: "companies-default", path: "/companies", access: "authenticated", family: "companies" },
  { id: "analytics-default", path: "/analytics", access: "authenticated", family: "analytics" },
  { id: "billing-default", path: "/billing", access: "authenticated", family: "billing" },
  { id: "profile-hub", path: "/profile", access: "authenticated", family: "profile" },
  { id: "profile-job-preferences", path: "/profile/job-preferences", access: "authenticated", family: "profile" },
  { id: "profile-resume", path: "/profile/resume", access: "authenticated", family: "profile" },
  { id: "profile-application-details", path: "/profile/application-details", access: "authenticated", family: "profile" },
  { id: "profile-personalization", path: "/profile/application-personalization", access: "authenticated", family: "profile" },
  { id: "profile-advanced", path: "/profile/advanced", access: "authenticated", family: "profile" },
  { id: "profile-account", path: "/profile/account", access: "authenticated", family: "profile" },
  { id: "admin-tenants", path: "/admin/tenants", access: "authenticated", family: "admin" },
  { id: "admin-invites", path: "/admin/invites", access: "authenticated", family: "admin" },
  { id: "onboarding", path: "/onboarding", access: "authenticated", family: "onboarding" },
];
