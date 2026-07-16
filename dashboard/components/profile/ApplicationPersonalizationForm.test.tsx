// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { ApplicationPersonalizationForm } from "./ApplicationPersonalizationForm";

afterEach(cleanup);

const profile = {
  resume_generation_instructions: "Lead with measurable outcomes.",
  cover_letter_generation_instructions: "Keep the tone warm and direct.",
} as ProfileRow;

describe("ApplicationPersonalizationForm", () => {
  test("renders reusable writing preferences and explains per-job layering", () => {
    render(<ApplicationPersonalizationForm profile={profile} />);

    expect((screen.getByLabelText("Résumé writing preferences") as HTMLTextAreaElement).value)
      .toBe("Lead with measurable outcomes.");
    expect((screen.getByLabelText("Cover letter writing preferences") as HTMLTextAreaElement).value)
      .toBe("Keep the tone warm and direct.");
    expect(screen.getByText(/defaults apply to every generated document/i)).not.toBeNull();
    expect(screen.getByText(/per-job instructions layer on top/i)).not.toBeNull();
  });

  test("keeps technical AI controls and terminology out of everyday personalization", () => {
    const { container } = render(<ApplicationPersonalizationForm profile={profile} />);
    const copy = container.textContent ?? "";

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(container.querySelector('[name^="model_"]')).toBeNull();
    expect(copy).not.toMatch(/\bmodel\b|model id|\bstage\b|\bgate\b|reasoning/i);
  });
});
