// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// This repo's vitest.config has no globals/setupFiles, so RTL's auto-cleanup never
// runs — renders accumulate across tests and duplicate-element queries throw. Clean up
// by hand (cf. components/rolefit/JobCard.test.tsx).
afterEach(cleanup);

vi.mock("@/app/actions/coverLetterEdits", () => ({
  saveCoverLetterEdit: vi.fn(async () => ({ ok: true, langfuseSynced: true })),
  deleteCoverLetterEdit: vi.fn(async () => ({ ok: true })),
}));

import { ApplicationPanel } from "@/components/rolefit/ApplicationPanel";
import type { JobRow } from "@/lib/types";

const job = { id: "job-1", company_name: "Acme", title: "Eng", ats: "lever", url: "https://x" } as unknown as JobRow;
const LETTER = {
  greeting: "Dear Hiring Manager,", paragraphs: ["Original model paragraph."],
  closing: "Sincerely,", signature: "Ada",
};

function renderPanel(coverEditedText: string | null) {
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
      status="prepared" appliedAt={null} onMarkApplied={() => {}}
      coverEditedText={coverEditedText}
      onCoverEditSaved={() => {}} onCoverEditReset={() => {}}
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
