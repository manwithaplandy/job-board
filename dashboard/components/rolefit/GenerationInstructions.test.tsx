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

  test("Save button is disabled when not dirty and enabled when dirty", () => {
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={async () => {}} dirty={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect((screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <GenerationInstructions value="Focus more" onChange={() => {}} kind="résumé" onSave={async () => {}} dirty={true} />,
    );
    expect((screen.getByRole("button", { name: /^save$/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("clicking Save invokes onSave and then shows a Saved confirmation", async () => {
    const onSave = vi.fn(async () => {});
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={onSave} dirty={true} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledOnce();
    // The parent flips dirty=false on save success (saved baseline := box); mirror that
    // so the "✓ Saved" chip (gated on justSaved && !dirty) appears as it does in real wiring.
    rerender(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={onSave} dirty={false} />,
    );
    expect(await screen.findByText(/✓ saved/i)).toBeTruthy();
  });

  test("typing during an in-flight save suppresses a false ✓ Saved confirmation", async () => {
    // The textarea is NOT disabled while saving, so a user can type mid-save. When onSave
    // resolves, justSaved flips true — but the box now holds newer text (dirty), so the
    // chip (gated on justSaved && !dirty) must stay hidden. No false confirmation.
    let resolveSave!: () => void;
    const onSave = vi.fn(() => new Promise<void>((r) => { resolveSave = r; }));
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={onSave} dirty={true} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledOnce();
    // User types while the save is in flight; the parent keeps dirty=true (box differs from
    // what's being saved). Mirror that with a rerender holding dirty=true.
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Focus more" } });
    resolveSave();
    rerender(
      <GenerationInstructions value="Focus more" onChange={() => {}} kind="résumé" onSave={onSave} dirty={true} />,
    );
    // The label reverts "Saving…" → "Save" in the same continuation that sets justSaved=true,
    // so awaiting the enabled Save button guarantees justSaved has flipped — a deterministic
    // wait with no fake timers. The chip must still be absent.
    await screen.findByRole("button", { name: /^save$/i });
    expect(screen.queryByText(/✓ saved/i)).toBeNull();
  });

  test("a rejected onSave shows no Saved confirmation and re-enables the button", async () => {
    const onSave = vi.fn(async () => { throw new Error("boom"); });
    render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" onSave={onSave} dirty={true} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    // Await the rejection settling: the label returns from "Saving…" to "Save"
    // only after the catch/finally re-render, so findByRole doubles as the wait.
    const saveButton = (await screen.findByRole("button", { name: /^save$/i })) as HTMLButtonElement;
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByText(/✓ saved/i)).toBeNull();
    // button re-enabled (still dirty, no longer saving)
    expect(saveButton.disabled).toBe(false);
  });

  test("renders no Save button when onSave is absent", () => {
    render(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" />);
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  test("applied badge reflects appliedState", () => {
    const { rerender } = render(
      <GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="applied" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /generation instructions/i }));
    expect(screen.getByText(/applied to current résumé/i)).toBeTruthy();
    rerender(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="pending" />);
    expect(screen.getByText(/not yet applied/i)).toBeTruthy();
    rerender(<GenerationInstructions value="Focus" onChange={() => {}} kind="résumé" appliedState="none" />);
    expect(screen.queryByText(/applied/i)).toBeNull();
  });
});
