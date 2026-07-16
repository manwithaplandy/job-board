// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("unexpected notFound"); }, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ getUserClaims: async () => ({ email: "admin@example.com" }) }));
vi.mock("@/lib/admin", () => ({ isAdmin: () => true }));
vi.mock("@/lib/invites", () => ({ listInvites: async () => [] }));
vi.mock("@/lib/tenantMetrics", () => ({ getTenantMetrics: async () => [] }));
vi.mock("@/components/admin/AdminNav", () => ({ AdminNav: () => <nav /> }));
vi.mock("@/components/admin/InviteGenerator", () => ({ InviteGenerator: () => <div /> }));
vi.mock("@/components/rolefit/SlimHeader", () => ({ SlimHeader: () => <div /> }));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const { default: AdminInvitesPage } = await import("./invites/page");
const { default: AdminTenantsPage } = await import("./tenants/page");

afterEach(cleanup);

describe("Admin first-run empty states", () => {
  it.each([
    ["invites", AdminInvitesPage, "No invite codes yet."],
    ["tenants", AdminTenantsPage, "No tenants yet."],
  ])("renders %s through compact shared EmptyState", async (_name, page, title) => {
    const { container } = render(await page());

    expect(container.querySelector(".rf-empty-state--compact")).not.toBeNull();
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  });
});
