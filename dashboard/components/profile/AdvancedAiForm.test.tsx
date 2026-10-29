// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { AdvancedAiForm } from "./AdvancedAiForm";

afterEach(cleanup);

const profile = {
  model_stage2: "sentinel/stage-two",
  model_resume: "sentinel/resume",
  model_cover: "sentinel/cover",
  model_company: "sentinel/company",
  reasoning_effort_resume: null,
  reasoning_effort_cover: null,
} as ProfileRow;

describe("AdvancedAiForm", () => {
  test("renders the reasoning controls", () => {
    render(<AdvancedAiForm profile={profile} isPro={true} />);
    for (const label of ["Résumé reasoning effort", "Cover letter reasoning effort"]) {
      expect(screen.getByLabelText(label)).not.toBeNull();
    }
  });

  test("offers no model choice: the plan decides, and stored picks are never shown", () => {
    const { container } = render(<AdvancedAiForm profile={profile} isPro={false} />);
    expect(container.querySelector('[name^="model_"]')).toBeNull();
    expect(container.textContent).not.toContain("sentinel/");
    expect(container.textContent).toMatch(/based on your plan/);
    expect(container.textContent).not.toMatch(/cheap gate/i);
    expect(container.textContent).toMatch(/Medium and High need Pro/);
  });
});
