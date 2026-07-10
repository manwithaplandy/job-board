// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ProfilePage from "./page";
import AccountPage from "./account/page";
import AdvancedPage from "./advanced/page";
import ApplicationDetailsPage from "./application-details/page";
import ApplicationPersonalizationPage from "./application-personalization/page";
import JobPreferencesPage from "./job-preferences/page";
import ResumePage from "./resume/page";

const boundaries = vi.hoisted(() => ({
  getDistinctLocations: vi.fn(),
  getProfile: vi.fn(),
  getStructuredModels: vi.fn(),
  getUserClaims: vi.fn(),
  getViewerPlan: vi.fn(),
  requireUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_cache: (callback: unknown) => callback }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getUserClaims: boundaries.getUserClaims,
  requireUserId: boundaries.requireUserId,
}));
vi.mock("@/lib/queries", () => ({
  getDistinctLocations: boundaries.getDistinctLocations,
  getProfile: boundaries.getProfile,
}));
vi.mock("@/lib/openrouter", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/openrouter")>(),
  getStructuredModels: boundaries.getStructuredModels,
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: boundaries.getViewerPlan }));
vi.mock("@/app/actions/profileSettings", () => ({
  saveAdvancedAiSettings: vi.fn(),
  saveApplicationDetails: vi.fn(),
  saveApplicationPersonalization: vi.fn(),
  saveJobPreferences: vi.fn(),
  saveResumeSettings: vi.fn(),
}));
vi.mock("@/app/actions/account", () => ({ deleteMyAccount: vi.fn() }));

const profile = {
  user_id: "user-1",
  resume_text: "Experienced engineer",
  resume_file_path: "user-1/resume.pdf",
  instructions: "Prioritize platform roles",
  model_stage1: null,
  model_stage2: null,
  preferred_locations: ["London"],
  model_resume: null,
  company_instructions: "Prefer developer tools",
  company_profile_version: null,
  model_company: null,
  board_filters: null,
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  phone: null,
  links: {},
  location: "London",
  work_authorized: true,
  needs_sponsorship: false,
  eeo_gender: null,
  eeo_race: null,
  eeo_veteran: null,
  eeo_disability: null,
  screening_answers: {},
  model_cover: null,
  reasoning_effort_resume: null,
  reasoning_effort_cover: null,
  resume_generation_instructions: "Keep it concise",
  cover_letter_generation_instructions: null,
  profile_version: "profile-version",
  updated_at: "2026-07-10T12:00:00.000Z",
} satisfies ProfileRow;

type Route = { name: string; renderPage: () => ReactElement | Promise<ReactElement> };
const detailRoutes: Route[] = [
  { name: "Job Preferences", renderPage: JobPreferencesPage },
  { name: "Résumé & Experience", renderPage: ResumePage },
  { name: "Application Details", renderPage: ApplicationDetailsPage },
  { name: "Application Personalization", renderPage: ApplicationPersonalizationPage },
  { name: "Advanced AI Settings", renderPage: AdvancedPage },
  { name: "Account & App", renderPage: AccountPage },
];

async function renderRoute(route: Route) {
  render(<ThemeProvider>{await route.renderPage()}</ThemeProvider>);
  return document.body;
}

function expectSequentialHeadings(container: HTMLElement) {
  const levels = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    (heading) => Number(heading.tagName.slice(1)));
  expect(levels[0]).toBe(1);
  levels.slice(1).forEach((level, index) => expect(level).toBeLessThanOrEqual(levels[index] + 1));
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  boundaries.requireUserId.mockResolvedValue("user-1");
  boundaries.getUserClaims.mockResolvedValue({ email: "ada@example.com" });
  boundaries.getProfile.mockResolvedValue(profile);
  boundaries.getDistinctLocations.mockResolvedValue([{ location: "London", count: 4 }]);
  boundaries.getStructuredModels.mockResolvedValue([
    { id: "provider/model-one", name: "Model One", pricing: { prompt: "", completion: "" } },
  ]);
  boundaries.getViewerPlan.mockResolvedValue("pro");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("profile route composition", () => {
  test.each([{ name: "Profile", renderPage: ProfilePage }, ...detailRoutes])(
    "$name has one h1 and sequential heading levels",
    async (route) => {
      const container = await renderRoute(route);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expectSequentialHeadings(container);
    },
  );

  test("keeps the four core hub cards in setup order", async () => {
    await renderRoute({ name: "Profile", renderPage: ProfilePage });
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Job Preferences",
      "Résumé & Experience",
      "Application Details",
      "Application Personalization",
    ]);
  });

  test.each(detailRoutes)("$name links back to the profile hub", async (route) => {
    await renderRoute(route);
    expect(screen.getByRole("link", { name: /back to profile/i }).getAttribute("href")).toBe("/profile");
  });

  test.each(detailRoutes)("$name uses a section-specific submit label", async (route) => {
    await renderRoute(route);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    for (const button of screen.queryAllByRole("button", { name: /^Save / })) {
      expect(button.textContent).not.toBe("Save");
    }
  });

  test.each(detailRoutes.filter(({ name }) => !name.startsWith("Advanced")))(
    "$name does not expose model identifiers",
    async (route) => {
      const container = await renderRoute(route);
      expect(container.querySelector('[name^="model_"]')).toBeNull();
      expect(container.textContent).not.toContain("provider/model-one");
    },
  );

  test("Advanced alone exposes model controls", async () => {
    const container = await renderRoute(detailRoutes[4]);
    expect(container.querySelectorAll('[name^="model_"]').length).toBeGreaterThan(0);
  });

  test.each(detailRoutes)("account deletion is scoped away from $name unless it is Account", async (route) => {
    await renderRoute(route);
    const deletion = screen.queryByText(/delete account/i);
    if (route.name === "Account & App") expect(deletion).not.toBeNull();
    else expect(deletion).toBeNull();
  });
});
