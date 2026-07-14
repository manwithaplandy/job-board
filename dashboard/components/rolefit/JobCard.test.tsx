// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { JobCard } from "./JobCard";
import type { JobRow } from "@/lib/types";

// Regression guard: an unscored job (fit_score === null, "not yet reviewed") must NOT
// get the red fitColor tint — fitColor(0) bottoms out at the red end of its scale, so an
// unscored card used to read as a misleading RED. It now matches JobDetail's neutral-grey
// "Not yet reviewed" card: var(--bg-muted) fill, var(--border) edge, var(--text-secondary)
// text, and NO computed oklch fit color anywhere. Scored cards keep the oklch tint.

function makeJob(overrides: Partial<JobRow>): JobRow {
  return {
    id: "job-1",
    title: "Staff Engineer",
    location: "Phoenix, AZ",
    remote: null,
    first_seen_at: "2026-07-01T00:00:00.000Z",
    closed_at: null,
    company_name: "Acme",
    ats: "greenhouse",
    human_override: false,
    verdict: null,
    role_category: null,
    seniority: null,
    work_arrangement: null,
    pay_min: null,
    pay_max: null,
    pay_currency: null,
    pay_period: null,
    headcount: null,
    skills_score: null,
    experience_score: null,
    comp_score: null,
    fit_score: null,
    skill_gaps: null,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("JobCard no-score neutral treatment", () => {
  test("unscored card uses neutral tokens and no red oklch fit tint", () => {
    render(<JobCard job={makeJob({ fit_score: null })} selected={false} onSelect={vi.fn()} />);

    // Card button — neutral fill/edge, never a computed oklch fit color.
    const card = screen.getByRole("button", { pressed: false });
    const cardStyle = card.getAttribute("style") ?? "";
    expect(cardStyle).toContain("var(--bg-muted)");
    expect(cardStyle).toContain("var(--border)");
    expect(cardStyle).not.toContain("oklch");

    // Fit badge shows the em-dash placeholder with neutral bg/text, not the red strong.
    const badge = screen.getByText("—");
    const badgeStyle = badge.getAttribute("style") ?? "";
    expect(badgeStyle).toContain("var(--bg-surface)");
    expect(badgeStyle).toContain("var(--text-secondary)");
    expect(badgeStyle).not.toContain("oklch");
  });

  test("scored card keeps the computed oklch fitColor on its score signal", () => {
    render(<JobCard job={makeJob({ fit_score: 82 })} selected={false} onSelect={vi.fn()} />);

    const card = screen.getByRole("button", { pressed: false });
    expect(card.getAttribute("style") ?? "").not.toContain("oklch");

    const badge = screen.getByText("82");
    const badgeStyle = badge.getAttribute("style") ?? "";
    expect(badgeStyle).toContain("oklch");
    expect(badgeStyle).not.toContain("var(--bg-surface)");
  });

  test("scored card confines fit color to the score signal instead of tinting the selectable surface", () => {
    render(<JobCard job={makeJob({ fit_score: 82 })} selected onSelect={vi.fn()} />);

    const card = screen.getByRole("button", { pressed: true });
    expect(card.getAttribute("style") ?? "").not.toContain("oklch");
    expect(card.getAttribute("data-selected")).toBe("true");
    expect(screen.getByText("82").getAttribute("style") ?? "").toContain("oklch");
    expect(card.querySelector(".rf-job-card__score-rail")).toBeNull();
  });
});
