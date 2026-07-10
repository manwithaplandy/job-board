// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { JobPreferencesForm } from "./JobPreferencesForm";

afterEach(cleanup);

const profile = {
  preferred_locations: ["London"],
  instructions: "Prioritize platform engineering; avoid adtech.",
  company_instructions: "Prefer developer tools companies.",
} as ProfileRow;

describe("JobPreferencesForm", () => {
  test("uses the route heading and renders only persisted preference controls", () => {
    const { container } = render(
      <main>
        <h1>Job Preferences</h1>
        <JobPreferencesForm
          profile={profile}
          locations={[{ location: "London", count: 12 }]}
        />
      </main>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const name of [
      "Where you want to work",
      "Priorities and deal-breakers",
      "Companies and industries",
      "Rolefit will",
    ]) {
      expect(screen.getByRole("heading", { name })).not.toBeNull();
    }

    expect(screen.getByLabelText("Must-haves and deal-breakers")).not.toBeNull();
    expect(container.querySelector('textarea[name="company_instructions"]')).not.toBeNull();
    expect(container.textContent).toContain(
      "Rolefit will use your locations and written guidance when reviewing jobs.",
    );

    for (const name of [
      "target_role",
      "seniority",
      "work_style",
      "employment_type",
      "salary",
    ]) {
      expect(container.querySelector(`[name="${name}"]`)).toBeNull();
    }
  });
});
