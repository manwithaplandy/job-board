import { type ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileModal } from "./ProfileModal";

afterEach(cleanup);

// Minimal props for an authed, open modal. saveResume is a spy so we can inspect
// the FormData the form submits.
const renderModal = (over: Partial<ComponentProps<typeof ProfileModal>> = {}) => {
  // Param typed so mock.calls[0][0] is a FormData (matches ProfileModal's saveResume prop).
  const saveResume = vi.fn(async (_fd: FormData) => {});
  const utils = render(
    <ProfileModal
      open
      isAuthed
      hasProfile
      resumeText=""
      onClose={() => {}}
      saveResume={saveResume}
      {...over}
    />,
  );
  const textarea = () => utils.container.querySelector<HTMLTextAreaElement>('textarea[name="resume_text"]')!;
  const fileInput = () => utils.container.querySelector<HTMLInputElement>('input[name="resume_pdf"]')!;
  return { saveResume, textarea, fileInput, ...utils };
};

describe("ProfileModal (Fix 3: both tab inputs stay mounted)", () => {
  test("both the paste textarea and the upload file input are in the DOM regardless of active tab", () => {
    const { textarea, fileInput } = renderModal();
    // Paste is the default tab, yet the Upload file input is still mounted.
    expect(textarea()).not.toBeNull();
    expect(fileInput()).not.toBeNull();
  });

  test("typed text survives switching to the Upload tab and back", () => {
    const { textarea } = renderModal();
    fireEvent.change(textarea(), { target: { value: "MY NEW RÉSUMÉ" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Paste text" }));
    // The textarea was never unmounted, so its value is intact.
    expect(textarea().value).toBe("MY NEW RÉSUMÉ");
  });

  test("submitting carries the typed resume_text", async () => {
    const { textarea, saveResume } = renderModal();
    fireEvent.change(textarea(), { target: { value: "SUBMITTED TEXT" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(saveResume).toHaveBeenCalledTimes(1));
    const fd = saveResume.mock.calls[0][0];
    expect(fd.get("resume_text")).toBe("SUBMITTED TEXT");
  });
});

describe("ProfileModal (M1: editing text clears a not-yet-saved file)", () => {
  const pickFile = (input: HTMLInputElement) => {
    const file = new File(["dummy pdf bytes"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    return file;
  };

  test("choosing a file shows the filename chip", () => {
    const { fileInput } = renderModal();
    pickFile(fileInput());
    expect(screen.getByText(/resume\.pdf/)).not.toBeNull();
    expect(fileInput().files?.length).toBe(1);
  });

  test("editing the pasted text clears the pending file selection", () => {
    const { textarea, fileInput } = renderModal();
    pickFile(fileInput());
    expect(fileInput().files?.length).toBe(1);

    fireEvent.change(textarea(), { target: { value: "typed after picking a file" } });

    // The filename chip is gone (uploadName state cleared). jsdom doesn't emulate
    // the real-browser "value='' clears .files" behavior, so the file actually
    // dropping from the submission is asserted at the FormData level in the next test.
    expect(screen.queryByText(/resume\.pdf/)).toBeNull();
  });

  test("after editing text, submit carries the text and no file", async () => {
    const { textarea, fileInput, saveResume } = renderModal();
    pickFile(fileInput());
    fireEvent.change(textarea(), { target: { value: "text wins" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    await waitFor(() => expect(saveResume).toHaveBeenCalledTimes(1));
    const fd = saveResume.mock.calls[0][0];
    expect(fd.get("resume_text")).toBe("text wins");
    const pdf = fd.get("resume_pdf") as File;
    expect(pdf.size).toBe(0); // empty file input → no bytes submitted
  });
});
