// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const actions = vi.hoisted(() => ({
  saveCoverLetterEdit: vi.fn(async () => ({ ok: true as const, langfuseSynced: true })),
  deleteCoverLetterEdit: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/app/actions/coverLetterEdits", () => actions);

import { CoverLetterEditor } from "@/components/rolefit/CoverLetterEditor";
import type { JobRow } from "@/lib/types";

const job = { id: "job-1", company_name: "Acme", title: "Eng" } as unknown as JobRow;

beforeEach(() => {
  actions.saveCoverLetterEdit.mockClear();
  actions.deleteCoverLetterEdit.mockClear();
});

// No globals/setupFiles + no environmentMatchGlobs in vitest.config.ts, so RTL's
// auto-cleanup never runs — renders accumulate across tests and duplicate the
// query targets. Every component test in this repo unmounts manually (house style).
afterEach(cleanup);

describe("CoverLetterEditor", () => {
  test("renders nothing for anon", () => {
    const { container } = render(
      <CoverLetterEditor job={job} letterText="Dear…" hasEdit={false} isAuthed={false}
        onSaved={() => {}} onReset={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  test("edit → save calls the action with the new text and fires onSaved", async () => {
    const onSaved = vi.fn();
    render(
      <CoverLetterEditor job={job} letterText="Dear Hiring Manager,\n\nOriginal." hasEdit={false}
        isAuthed onSaved={onSaved} onReset={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit letter/i }));
    const ta = screen.getByLabelText(/edited cover letter/i);
    fireEvent.change(ta, { target: { value: "Dear Hiring Manager,\n\nEdited." } });
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    await waitFor(() =>
      expect(actions.saveCoverLetterEdit).toHaveBeenCalledWith("job-1", "Dear Hiring Manager,\n\nEdited.", null),
    );
    expect(onSaved).toHaveBeenCalledWith("job-1", "Dear Hiring Manager,\n\nEdited.");
    expect(screen.getByText(/edit saved/i)).toBeDefined();
  });

  test("failed LangFuse sync still saves, shows the reconcile note", async () => {
    actions.saveCoverLetterEdit.mockResolvedValueOnce({ ok: true, langfuseSynced: false });
    render(
      <CoverLetterEditor job={job} letterText="Dear…" hasEdit={false} isAuthed
        onSaved={() => {}} onReset={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit letter/i }));
    fireEvent.click(screen.getByRole("button", { name: /save edit/i }));
    await waitFor(() => expect(screen.getByText(/will reconcile/i)).toBeDefined());
  });

  test("'Reset to generated' shows only with an edit, calls delete + onReset", async () => {
    const onReset = vi.fn();
    render(
      <CoverLetterEditor job={job} letterText="Edited text" hasEdit isAuthed
        onSaved={() => {}} onReset={onReset} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reset to generated/i }));
    await waitFor(() => expect(actions.deleteCoverLetterEdit).toHaveBeenCalledWith("job-1"));
    expect(onReset).toHaveBeenCalledWith("job-1");
  });
});
