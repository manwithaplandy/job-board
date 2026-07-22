// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { EMPTY_EXCLUSIONS } from "@/lib/rolefit/companyExclusions";
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
  saveCompanyFilters: vi.fn(),
  saveJobPreferences: vi.fn(),
  saveResumeSettings: vi.fn(),
}));
vi.mock("@/app/actions/account", () => ({ deleteMyAccount: vi.fn() }));

const profile = {
  user_id: "user-1",
  resume_text: "Experienced engineer",
  resume_file_path: "user-1/resume.pdf",
  instructions: "Prioritize platform roles",
  model_stage1: "sentinel/stage-one",
  model_stage2: "sentinel/stage-two",
  preferred_locations: ["London"],
  model_resume: "sentinel/resume",
  company_instructions: "Prefer developer tools",
  company_profile_version: null,
  model_company: "sentinel/company",
  board_filters: null,
  company_exclusions: EMPTY_EXCLUSIONS,
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
  model_cover: "sentinel/cover",
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
const profileRoute = { name: "Profile", renderPage: ProfilePage };
const modelSentinels = [
  "sentinel/stage-one",
  "sentinel/stage-two",
  "sentinel/resume",
  "sentinel/company",
  "sentinel/cover",
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
  test.each([profileRoute, ...detailRoutes])(
    "$name has one h1 and sequential heading levels",
    async (route) => {
      const container = await renderRoute(route);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expectSequentialHeadings(container);
    },
  );

  test("keeps the four core hub cards in setup order", async () => {
    await renderRoute(profileRoute);
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

  test.each([
    // Job Preferences hosts two sections: the preferences form + the company-exclusion
    // filters form (each its own SectionFormShell save button).
    { ...detailRoutes[0], submitLabel: "Save preferences", extraSubmitLabels: ["Save company filters"] },
    { ...detailRoutes[1], submitLabel: "Save résumé", extraSubmitLabels: [] },
    { ...detailRoutes[2], submitLabel: "Save details", extraSubmitLabels: [] },
    { ...detailRoutes[3], submitLabel: "Save writing preferences", extraSubmitLabels: [] },
    { ...detailRoutes[4], submitLabel: "Save AI settings", extraSubmitLabels: [] },
  ])("$name exposes its exact section submit label", async ({ submitLabel, extraSubmitLabels, ...route }) => {
    await renderRoute(route);
    expect(screen.getByRole("button", { name: submitLabel })).not.toBeNull();
    for (const label of extraSubmitLabels) expect(screen.getByRole("button", { name: label })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: /^Save(?: |$)/ })).toHaveLength(1 + extraSubmitLabels.length);
  });

  test("Account & App has no section save action", async () => {
    await renderRoute(detailRoutes[5]);
    expect(screen.queryByRole("button", { name: /^Save(?: |$)/ })).toBeNull();
  });

  test.each([profileRoute, ...detailRoutes.filter(({ name }) => !name.startsWith("Advanced"))])(
    "$name does not expose stored model identifiers",
    async (route) => {
      const container = await renderRoute(route);
      expect(container.querySelector('[name^="model_"]')).toBeNull();
      for (const sentinel of modelSentinels) {
        expect(container.textContent).not.toContain(sentinel);
        expect(container.querySelector(`[value="${sentinel}"]`)).toBeNull();
      }
    },
  );

  test("Advanced exposes each editable saved model selection but not the internal Stage 1 id", async () => {
    await renderRoute(detailRoutes[4]);
    const expectedSelections = [
      ["Stage 2 — full-description review model", profile.model_stage2],
      ["Company review model", profile.model_company],
      ["Résumé model", profile.model_resume],
      ["Cover letter model", profile.model_cover],
    ] as const;
    for (const [label, sentinel] of expectedSelections) {
      expect(screen.getByRole<HTMLInputElement>("combobox", { name: label }).value).toBe(sentinel);
      expect(document.querySelector<HTMLInputElement>(`input[type="hidden"][value="${sentinel}"]`)?.value).toBe(sentinel);
    }
    expect(document.body.textContent).not.toContain(profile.model_stage1);
    expect(document.querySelector(`[value="${profile.model_stage1}"]`)).toBeNull();
  });

  test.each(detailRoutes)("account deletion is scoped away from $name unless it is Account", async (route) => {
    await renderRoute(route);
    const deletion = screen.queryByText(/delete account/i);
    if (route.name === "Account & App") expect(deletion).not.toBeNull();
    else expect(deletion).toBeNull();
  });
});
