// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "user-1",
  getUserClaims: async () => ({ email: "user@example.com" }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/lib/queries", () => ({
  getCompanyReviews: async () => [],
  getCompanyVerdictCounts: async () => ({ include: 0, exclude: 0, unknown: 0 }),
  getDiscoveryState: async () => ({}),
}));
vi.mock("@/app/actions/companies", () => ({
  setCompanyOverride: vi.fn(),
  refreshCompanyDiscoveryStatus: vi.fn(),
}));
vi.mock("@/components/rolefit/SlimHeader", () => ({ SlimHeader: () => <div /> }));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const { default: CompaniesPage } = await import("./page");

afterEach(cleanup);

describe("Companies first-run empty state", () => {
  it("uses the shared state hierarchy and preserves the profile action", async () => {
    const { container } = render(await CompaniesPage({ searchParams: Promise.resolve({}) }));

    expect(container.querySelector(".rf-empty-state")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "No companies classified yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "company preferences" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByText(/As your board is reviewed/)).toBeTruthy();
  });
});
