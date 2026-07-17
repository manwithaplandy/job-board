// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    location_canonicals: null,
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

describe("JobCard — live-arrival highlight", () => {
  const popJob: JobRow = {
    id: "greenhouse:acme:1",
    title: "Staff Engineer",
    location: "Phoenix, AZ",
    location_canonicals: null,
    remote: true,
    first_seen_at: "2026-07-01T00:00:00.000Z",
    closed_at: null,
    company_name: "Acme",
    ats: "greenhouse",
    human_override: false,
    verdict: "approve",
    role_category: "engineering",
    seniority: "staff",
    work_arrangement: "remote",
    pay_min: 150000,
    pay_max: 200000,
    pay_currency: "USD",
    pay_period: "year",
    headcount: null,
    skills_score: 8,
    experience_score: 8,
    comp_score: 8,
    fit_score: 88,
    skill_gaps: [],
  };

  test("isNew adds the arrival class to the card root", () => {
    const { container } = render(
      <JobCard job={popJob} selected={false} onSelect={() => {}} isNew />,
    );
    expect(container.querySelector(".rf-job-card.rf-job-card--new")).toBeTruthy();
  });

  test("without isNew the arrival class is absent", () => {
    const { container } = render(
      <JobCard job={popJob} selected={false} onSelect={() => {}} />,
    );
    expect(container.querySelector(".rf-job-card")).toBeTruthy();
    expect(container.querySelector(".rf-job-card--new")).toBeNull();
  });
});

describe("JobCard - reject affordance", () => {
  test("with onReject: labeled Reject pill, reserved-slot modifier, reject-not-select on click", () => {
    const onReject = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <JobCard job={makeJob({ fit_score: 82 })} selected={false} onSelect={onSelect} onReject={onReject} />,
    );
    // Reserved-slot modifier drives the chips-row gutter in board.css.
    expect(container.querySelector(".rf-job-card.rf-job-card--rejectable")).toBeTruthy();
    const reject = screen.getByRole("button", { name: "Reject Staff Engineer" });
    // Visible text label (not an icon-only control); accessible name keeps the job
    // title so screen readers hear which job each pill rejects (and the visible
    // "Reject" is contained in it - WCAG 2.5.3 label-in-name).
    expect(reject.textContent).toBe("Reject");
    expect(reject.querySelector("svg")).toBeNull();
    // Pin the class board.css keys on: without it the pill silently loses all its
    // styling (absolute slot, danger tint, hidden-at-rest) yet every other check passes.
    expect(reject.className).toContain("rf-job-card__reject");
    fireEvent.click(reject);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledWith("job-1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("without onReject: no reject control and no reserved-slot modifier", () => {
    const { container } = render(
      <JobCard job={makeJob({ fit_score: 82 })} selected={false} onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Reject/ })).toBeNull();
    expect(container.querySelector(".rf-job-card--rejectable")).toBeNull();
  });
});
