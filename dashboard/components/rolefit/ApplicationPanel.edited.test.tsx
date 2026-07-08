// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// This repo's vitest.config has no globals/setupFiles, so RTL's auto-cleanup never
// runs — renders accumulate across tests and duplicate-element queries throw. Clean up
// by hand (cf. components/rolefit/JobCard.test.tsx).
afterEach(cleanup);

vi.mock("@/app/actions/coverLetterEdits", () => ({
  saveCoverLetterEdit: vi.fn(async () => ({ ok: true, langfuseSynced: true })),
  deleteCoverLetterEdit: vi.fn(async () => ({ ok: true })),
}));

import { ApplicationPanel, type ApplicationPanelProps } from "@/components/rolefit/ApplicationPanel";
import type { JobRow } from "@/lib/types";

const job = { id: "job-1", company_name: "Acme", title: "Eng", ats: "lever", url: "https://x" } as unknown as JobRow;
const LETTER = {
  greeting: "Dear Hiring Manager,", paragraphs: ["Original model paragraph."],
  closing: "Sincerely,", signature: "Ada",
};

function renderPanel(
  coverEditedText: string | null,
  overrides: Partial<ApplicationPanelProps> = {},
) {
  return render(
    <ApplicationPanel
      job={job} isAuthed
      resumeState={undefined} resumeData={undefined} resumeStale={false}
      onGenerateResume={() => {}} onRegenerateResume={() => {}} onCopyResume={() => {}}
      resumeCopyLabel="Copy" usingSample={false} onOpenProfile={() => {}}
      coverState="done" coverData={LETTER}
      onGenerateCover={() => {}} onRegenerateCover={() => {}}
      onPrepare={() => {}}
      greenhouseQuestions={null} prefilledAnswers={null}
      status="prepared" appliedAt={null}
      coverEditedText={coverEditedText}
      onCoverEditSaved={() => {}} onCoverEditReset={() => {}}
      resumeInstructions="" onResumeInstructionsChange={() => {}}
      coverInstructions="" onCoverInstructionsChange={() => {}}
      resumeInstructionsDirty={false} resumeInstructionsApplied="none" onSaveResumeInstructions={async () => {}}
      coverInstructionsDirty={false} coverInstructionsApplied="none" onSaveCoverInstructions={async () => {}}
      {...overrides}
    />,
  );
}

describe("ApplicationPanel — edited cover letter display", () => {
  test("a current edit renders over the structured letter with an Edited chip", () => {
    renderPanel("Dear Hiring Manager,\n\nHuman-edited paragraph.\n\nSincerely,\nAda");
    expect(screen.getByText(/human-edited paragraph/i)).toBeDefined();
    expect(screen.getByText(/^Edited$/)).toBeDefined();
    expect(screen.queryByText(/original model paragraph/i)).toBeNull();
  });

  test("no edit → the structured letter renders, no chip", () => {
    renderPanel(null);
    expect(screen.getByText(/original model paragraph/i)).toBeDefined();
    expect(screen.queryByText(/^Edited$/)).toBeNull();
  });
});

describe("ApplicationPanel — cover generation instructions", () => {
  test("expander seeds from the persisted value and propagates edits", () => {
    const onCoverInstructionsChange = vi.fn();
    renderPanel(null, { coverInstructions: "Persisted focus", onCoverInstructionsChange });
    // Two expanders render (résumé + cover); the cover one is inside the cover panel.
    const toggles = screen.getAllByRole("button", { name: /generation instructions/i });
    fireEvent.click(toggles[toggles.length - 1]);
    const ta = screen.getByPlaceholderText(/cover letter should focus on/i) as HTMLTextAreaElement;
    expect(ta.value).toBe("Persisted focus");
    fireEvent.change(ta, { target: { value: "New focus" } });
    expect(onCoverInstructionsChange).toHaveBeenCalledWith("New focus");
  });
});
