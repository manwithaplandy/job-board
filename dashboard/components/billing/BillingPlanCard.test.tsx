// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ENTITLEMENTS, PLAN_PRICE_USD, type Plan } from "@/lib/entitlements";
import { TierCard } from "@/app/billing/page";

afterEach(cleanup);

describe("TierCard plan identity", () => {
  test.each<Plan>(["standard", "pro"])("keeps %s identity separate from current status", (plan) => {
    const { container } = render(<TierCard plan={plan} currentPlan={plan} entitlements={ENTITLEMENTS} prices={PLAN_PRICE_USD} />);
    expect(screen.getByRole("heading", { name: plan === "pro" ? "Pro" : "Standard" })).toBeTruthy();
    expect(container.querySelector(".rf-badge")?.textContent).toBe("Current plan");
  });
});
