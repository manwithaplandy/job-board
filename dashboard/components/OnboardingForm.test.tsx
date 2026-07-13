// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { OnboardingForm } from "./OnboardingForm";

afterEach(cleanup);

describe("OnboardingForm shared typography", () => {
  test("renders globally styled picker and upload metadata hooks on the real onboarding surface", () => {
    render(<OnboardingForm action={async () => null} locationOptions={[{ location: "London", count: 2 }]} />);
    expect(screen.getByText(/Locations to include/).classList).toContain("rf-picker-label");
    expect(screen.getByRole("combobox").classList).toContain("rf-picker-input");
    expect(screen.getByText("No file chosen").classList).toContain("resume-upload-filename");
    expect(screen.getByRole("status").classList).toContain("resume-upload-status");

    const globalCss = readFileSync("app/globals.css", "utf8");
    expect(globalCss).toMatch(/\.rf-picker-label, \.rf-picker-input, \.rf-picker-listbox\s*\{[^}]*font-size:\s*13px/s);
    expect(globalCss).toMatch(/\.rf-picker-chip\s*\{[^}]*font-size:\s*12px/s);
    expect(globalCss).toMatch(/\.resume-upload-filename\s*\{[^}]*font-size:\s*12\.5px/s);
  });
});
