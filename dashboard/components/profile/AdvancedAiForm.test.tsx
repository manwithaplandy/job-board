// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ORModel } from "@/lib/openrouter";
import type { ProfileRow } from "@/lib/types";
import { AdvancedAiForm } from "./AdvancedAiForm";

afterEach(cleanup);

const models: ORModel[] = [
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", pricing: { prompt: "", completion: "" } },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", pricing: { prompt: "", completion: "" } },
];
const profile = {
  model_stage2: null,
  model_resume: null,
  model_cover: null,
  model_company: null,
  reasoning_effort_resume: null,
  reasoning_effort_cover: null,
} as ProfileRow;

describe("AdvancedAiForm", () => {
  test("renders every current model and reasoning control", () => {
    render(<AdvancedAiForm profile={profile} models={models} isPro={true} />);

    for (const label of [
      "Stage 2 — full-description review model",
      "Résumé model",
      "Cover letter model",
      "Company review model",
      "Résumé reasoning effort",
      "Cover letter reasoning effort",
    ]) expect(screen.getByLabelText(label)).not.toBeNull();
  });

  test("presents Stage 1 as read-only and avoids internal gate terminology", () => {
    const { container } = render(<AdvancedAiForm profile={profile} models={models} isPro={false} />);

    expect(screen.getByText("Stage 1 — title and company check")).not.toBeNull();
    expect(screen.getByText("Always uses the Rolefit default")).not.toBeNull();
    expect(container.querySelector('[name="model_stage1"]')).toBeNull();
    expect(container.textContent).not.toMatch(/cheap gate/i);
    expect(container.textContent).toMatch(/require the Pro plan/);
  });
});
