// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReasoningEffortSelect } from "@/components/ReasoningEffortSelect";

afterEach(cleanup);

describe("ReasoningEffortSelect", () => {
  test("renders all four levels with Off selected by default", () => {
    render(<ReasoningEffortSelect label="Résumé reasoning effort"
      name="reasoning_effort_resume" defaultValue={null} isPro={true} />);
    const select = screen.getByLabelText("Résumé reasoning effort") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "low", "medium", "high"]);
    // Pro sees no disabled options and no "(Pro)" suffixes.
    expect(Array.from(select.options).every((o) => !o.disabled)).toBe(true);
    expect(screen.queryByText(/\(Pro\)/)).toBeNull();
  });

  test("non-Pro: medium/high are disabled and labelled (Pro)", () => {
    render(<ReasoningEffortSelect label="Cover letter reasoning effort"
      name="reasoning_effort_cover" defaultValue={null} isPro={false} />);
    const select = screen.getByLabelText("Cover letter reasoning effort") as HTMLSelectElement;
    const byValue = Object.fromEntries(Array.from(select.options).map((o) => [o.value, o]));
    expect(byValue[""].disabled).toBe(false);
    expect(byValue["low"].disabled).toBe(false);
    expect(byValue["medium"].disabled).toBe(true);
    expect(byValue["high"].disabled).toBe(true);
    expect(byValue["medium"].textContent).toContain("(Pro)");
  });

  test("a saved level is preselected", () => {
    render(<ReasoningEffortSelect label="Résumé reasoning effort"
      name="reasoning_effort_resume" defaultValue="high" isPro={true} />);
    expect((screen.getByLabelText("Résumé reasoning effort") as HTMLSelectElement).value).toBe("high");
  });

  test("non-Pro with a stored Pro-only level renders the clamped 'low'", () => {
    // Disabled selected options are not submitted by browsers, so rendering
    // "high" here would make a save drop the field → NULL (Off). Render the
    // clamped value the call-time clamp already uses so the form round-trips it.
    render(<ReasoningEffortSelect label="Résumé reasoning effort"
      name="reasoning_effort_resume" defaultValue="high" isPro={false} />);
    expect((screen.getByLabelText("Résumé reasoning effort") as HTMLSelectElement).value).toBe("low");
  });
});
