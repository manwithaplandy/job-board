// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { GenerationInstructions } from "@/components/rolefit/GenerationInstructions";

// This repo's vitest.config.ts has no globals/setupFiles, so RTL auto-cleanup does
// NOT run — renders accumulate across tests and duplicate-element queries throw.
// Clean up after each test (cf. JobCard.test.tsx).
afterEach(cleanup);

describe("GenerationInstructions", () => {
  test("collapsed by default; expanding reveals the textarea with the seeded value", () => {
    render(<GenerationInstructions value="Focus on infra" onChange={() => {}} kind="résumé" />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Focus on infra");
  });

  test("stays collapsed until toggled; typing propagates onChange", () => {
    const onChange = vi.fn();
    render(<GenerationInstructions value="" onChange={onChange} kind="cover letter" />);
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mention the launch" } });
    expect(onChange).toHaveBeenCalledWith("Mention the launch");
  });
});
