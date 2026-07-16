// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { JobPreferencesForm } from "./JobPreferencesForm";

const mocks = vi.hoisted(() => ({ saveJobPreferences: vi.fn() }));
vi.mock("@/app/actions/profileSettings", () => ({
  saveJobPreferences: mocks.saveJobPreferences,
}));

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

  test("maps an empty-location server error to the visible combobox", async () => {
    mocks.saveJobPreferences.mockResolvedValueOnce({
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { preferred_locations: "Pick at least one location." },
    });
    render(
      <JobPreferencesForm
        profile={{ ...profile, preferred_locations: ["London"] }}
        locations={[{ location: "London", count: 12 }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove London" }));
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    const error = await screen.findByText("Pick at least one location.", { selector: ".field-error" });
    const combobox = screen.getByRole("combobox");
    const summaryLink = screen.getByRole("link", { name: "Pick at least one location." });
    await waitFor(() => expect(document.activeElement).toBe(combobox));
    expect(summaryLink.getAttribute("href")).toBe(`#${combobox.id}`);
    expect(combobox.getAttribute("aria-invalid")).toBe("true");
    expect(combobox.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
    expect(error.id).not.toBe("");
  });

  test("updates interpretation preview from live values and keeps save/reset baselines synchronized", async () => {
    mocks.saveJobPreferences.mockResolvedValue({ status: "success", savedAt: "2026-07-10T12:00:00Z" });
    render(<JobPreferencesForm profile={profile} locations={[{ location: "London", count: 12 }, { location: "Paris", count: 7 }]} />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByRole("option", { name: /Paris/ }));
    expect(screen.getByText(/London, Paris/)).toBeTruthy();
    const guidance = screen.getByLabelText("Must-haves and deal-breakers");
    fireEvent.change(guidance, { target: { value: "Prioritize distributed systems" } });
    expect(screen.getByText(/Prioritize distributed systems/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await screen.findByText("Changes saved");
    fireEvent.change(guidance, { target: { value: "Temporary edit" } });
    expect(screen.queryByText("Changes saved")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/Prioritize distributed systems/)).toBeTruthy();
    expect(screen.getByText(/London, Paris/)).toBeTruthy();
  });
});
