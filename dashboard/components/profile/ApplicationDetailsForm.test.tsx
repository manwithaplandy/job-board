// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { ApplicationDetailsForm } from "./ApplicationDetailsForm";

afterEach(cleanup);

const profile = {
  full_name: "Ada Lovelace",
  location: "London",
  email: "ada@example.com",
  phone: "+44 20 7946 0958",
  links: {
    linkedin: "https://linkedin.com/in/ada",
    github: "https://github.com/ada",
    portfolio: "https://ada.example.com",
  },
  work_authorized: true,
  needs_sponsorship: null,
  screening_answers: {
    notice_period: "Two weeks",
    salary_expectation: "Market rate",
    relocation: "Open to relocating",
  },
  eeo_gender: "Woman",
  eeo_race: "Prefer not to say",
  eeo_veteran: "Not a veteran",
  eeo_disability: "Prefer not to say",
} as ProfileRow;

describe("ApplicationDetailsForm", () => {
  test("renders current application fields in semantic sections", () => {
    const { container } = render(<ApplicationDetailsForm profile={profile} />);

    for (const name of [
      "Contact information",
      "Links",
      "Work eligibility",
      "Common screening answers",
      "Voluntary demographic information",
    ]) {
      expect(screen.getByRole("heading", { name })).not.toBeNull();
    }

    const demographics = container.querySelector("details");
    expect(demographics).not.toBeNull();
    expect(demographics?.open).toBe(false);
    expect(demographics?.textContent).toContain(
      "These answers are optional and are not used to rank jobs.",
    );

    expect(screen.getByLabelText(/^Full name/).getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText("Home location").getAttribute("autocomplete")).toBe("address-level2");
    expect(screen.getByLabelText(/^Email/).getAttribute("type")).toBe("email");
    expect(screen.getByLabelText(/^Email/).getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Phone").getAttribute("type")).toBe("tel");
    expect(screen.getByLabelText("Phone").getAttribute("autocomplete")).toBe("tel");

    for (const label of ["LinkedIn", "GitHub", "Portfolio"]) {
      expect(screen.getByLabelText(label).getAttribute("type")).toBe("url");
    }
  });
});
