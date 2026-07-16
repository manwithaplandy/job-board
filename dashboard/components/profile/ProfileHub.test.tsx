// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ProfileReadiness } from "@/lib/profileReadiness";
import { ProfileHub } from "./ProfileHub";

afterEach(cleanup);

const readiness: ProfileReadiness = {
  readyCount: 3,
  totalCore: 3,
  overall: "Ready to find matching jobs",
  jobPreferences: { status: "Ready", summary: "2 locations · Matching guidance added" },
  resume: { status: "Ready", summary: "Résumé updated 2026-07-09" },
  applicationDetails: { status: "Ready", summary: "Name and email ready" },
  personalization: { status: "Optional", summary: "Writing preferences added" },
};

describe("ProfileHub", () => {
  test("renders a read-only task hub in the approved order", () => {
    const { container } = render(<ProfileHub readiness={readiness} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Profile");
    expect(screen.getByText("Ready to find matching jobs")).not.toBeNull();
    expect(screen.getByText("3 of 3 core sections ready")).not.toBeNull();

    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(4);
    expect(articles.map((article) => article.querySelector("h2")?.textContent)).toEqual([
      "Job Preferences",
      "Résumé & Experience",
      "Application Details",
      "Application Personalization",
    ]);

    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(container.textContent).not.toMatch(/model/i);
    expect(screen.queryByRole("button", { name: /delete account/i })).toBeNull();
  });

  test("links primary tasks and secondary settings without editable controls", () => {
    render(<ProfileHub readiness={readiness} />);

    expect(screen.getByRole("link", { name: "Review preferences" }).getAttribute("href")).toBe("/profile/job-preferences");
    expect(screen.getByRole("link", { name: "Review résumé" }).getAttribute("href")).toBe("/profile/resume");
    expect(screen.getByRole("link", { name: "Review details" }).getAttribute("href")).toBe("/profile/application-details");
    expect(screen.getByRole("link", { name: "Review personalization" }).getAttribute("href")).toBe("/profile/application-personalization");

    const secondary = screen.getByRole("navigation", { name: "Secondary settings" });
    expect(Array.from(secondary.querySelectorAll("a"), (link) => link.textContent)).toEqual([
      "Appearance",
      "Plan & billing",
      "Advanced AI settings",
      "Account",
    ]);
  });
});
