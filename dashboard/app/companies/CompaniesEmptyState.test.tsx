// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Mutable per-test knobs (hoisted so the vi.mock factories can close over them).
const knobs = vi.hoisted(() => ({ admin: false, counts: { all: 0, included: 0, excluded: 0 } }));

vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "user-1",
  getUserClaims: async () => ({ email: "user@example.com" }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => knobs.admin }));
vi.mock("@/lib/queries", () => ({
  getCompaniesBrowse: async () => [],
  getCompanyOverrideCounts: async () => knobs.counts,
  getDiscoveryState: async () => ({}),
}));
vi.mock("@/app/actions/companies", () => ({
  setCompanyOverride: vi.fn(),
  refreshCompanyDiscoveryStatus: vi.fn(),
}));
vi.mock("@/components/rolefit/SlimHeader", () => ({ SlimHeader: () => <div /> }));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
// Stub the (client) list so the empty-vs-populated branch is what we assert — not the
// router-driven browse UI.
vi.mock("@/components/companies/CompanyList", () => ({ CompanyList: () => <div data-testid="company-list" /> }));

const { default: CompaniesPage } = await import("./page");

afterEach(cleanup);
beforeEach(() => {
  knobs.admin = false;
  knobs.counts = { all: 0, included: 0, excluded: 0 };
});

describe("Companies empty corpus state", () => {
  it("a non-admin sees the shared empty state pointing at company preferences", async () => {
    const { container } = render(await CompaniesPage({ searchParams: Promise.resolve({}) }));

    expect(container.querySelector(".rf-empty-state")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "No companies yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "company preferences" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByText(/Companies appear here as the corpus is classified/)).toBeTruthy();
    expect(screen.queryByTestId("company-list")).toBeNull();
  });

  it("an admin gets a direct link to launch a classification job", async () => {
    knobs.admin = true;
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: "Run a classification job" }).getAttribute("href")).toBe("/admin/classification");
  });
});

describe("Companies populated corpus", () => {
  it("renders the browse list once any company exists (not the empty state)", async () => {
    knobs.counts = { all: 42, included: 3, excluded: 1 };
    render(await CompaniesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("company-list")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No companies yet" })).toBeNull();
  });
});
