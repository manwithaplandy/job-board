// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { ResumeSettingsForm } from "./ResumeSettingsForm";

const mocks = vi.hoisted(() => ({ saveResumeSettings: vi.fn() }));
vi.mock("@/app/actions/profileSettings", () => ({ saveResumeSettings: mocks.saveResumeSettings }));

beforeEach(() => {
  mocks.saveResumeSettings.mockResolvedValue({ status: "success", savedAt: "2026-07-10T12:00:00Z" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const profile = {
  resume_file_path: "profiles/u1/original-resume.pdf",
  resume_text: "Reviewed experience",
  updated_at: "2026-07-01T12:00:00.000Z",
} as ProfileRow;

describe("ResumeSettingsForm", () => {
  test("summarizes the canonical reviewed text and keeps the editor collapsed", () => {
    render(<ResumeSettingsForm profile={profile} />);

    expect(screen.getByText(/reviewed résumé text powers matching/i)).toBeTruthy();
    expect(screen.getByText("original-resume.pdf")).toBeTruthy();
    expect(screen.getByText(/pdf is kept only as an archive/i)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /reviewed résumé text/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    expect(screen.getByRole("textbox", { name: /reviewed résumé text/i })).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("No file chosen").classList).toContain("resume-upload-filename");
    expect(screen.getByRole("status").classList).toContain("resume-upload-status");
  });

  test("uploads a replacement and synchronizes extracted text with the submitted value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ markdown: "Extracted text" }), { status: 200 }));
    const { container } = render(<ResumeSettingsForm profile={profile} />);
    const file = new File(["pdf"], "replacement.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[name="resume_pdf"]')!, { target: { files: [file] } });

    await screen.findByText(/extracted — review/i);
    expect((container.querySelector('input[type="hidden"][name="resume_text"]') as HTMLInputElement).value).toBe("Extracted text");
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    expect((screen.getByRole("textbox", { name: /reviewed résumé text/i }) as HTMLTextAreaElement).value).toBe("Extracted text");
  });

  test("does not overwrite unsaved reviewed text unless the user confirms", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ markdown: "PDF text" }), { status: 200 }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container } = render(<ResumeSettingsForm profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /reviewed résumé text/i }), { target: { value: "Unsaved edit" } });
    fireEvent.change(container.querySelector('input[name="resume_pdf"]')!, {
      target: { files: [new File(["pdf"], "new.pdf", { type: "application/pdf" })] },
    });

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Replace your unsaved résumé edits with the extracted PDF text?"));
    expect((screen.getByRole("textbox", { name: /reviewed résumé text/i }) as HTMLTextAreaElement).value).toBe("Unsaved edit");
  });

  test("Cancel restores an expanded controlled editor to its saved baseline", async () => {
    render(<ResumeSettingsForm profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    const editor = screen.getByRole<HTMLInputElement>("textbox", { name: /reviewed résumé text/i });
    fireEvent.change(editor, { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(editor.value).toBe("Reviewed experience"));
  });

  test("Cancel while collapsed discards the edit from both hidden and reopened controls", async () => {
    const { container } = render(<ResumeSettingsForm profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /reviewed résumé text/i }), { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: /hide reviewed text/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect((container.querySelector('input[name="resume_text"]') as HTMLInputElement).value).toBe("Reviewed experience"));
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /reviewed résumé text/i }).value).toBe("Reviewed experience");
  });

  test("successful save advances the extraction-confirmation baseline, while later edits still prompt", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ markdown: "Uploaded text" }), { status: 200 }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<ResumeSettingsForm profile={profile} />);
    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    const editor = screen.getByRole<HTMLInputElement>("textbox", { name: /reviewed résumé text/i });
    fireEvent.change(editor, { target: { value: "New saved baseline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save résumé" }));
    await screen.findByText("Changes saved");

    const upload = (name: string) => fireEvent.change(container.querySelector('input[name="resume_pdf"]')!, {
      target: { files: [new File(["pdf"], name, { type: "application/pdf" })] },
    });
    upload("first.pdf");
    await screen.findByText(/extracted — review/i);
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(editor, { target: { value: "Another unsaved edit" } });
    upload("second.pdf");
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("Replace your unsaved résumé edits with the extracted PDF text?"));
  });

  test("successful file save clears the upload baseline and later saves omit the prior file", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ markdown: "Uploaded text" }), { status: 200 }));
    const { container } = render(<ResumeSettingsForm profile={profile} />);
    const input = container.querySelector<HTMLInputElement>('input[name="resume_pdf"]')!;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "new.pdf", { type: "application/pdf" })] } });
    await screen.findByText(/extracted — review/i);
    fireEvent.input(input);
    fireEvent.click(screen.getByRole("button", { name: "Save résumé" }));
    await screen.findByText("Changes saved");
    expect(container.querySelector<HTMLInputElement>('input[name="resume_pdf"]')!.files).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /review extracted text/i }));
    const editor = screen.getByRole<HTMLInputElement>("textbox", { name: /reviewed résumé text/i });
    fireEvent.change(editor, { target: { value: "Later edit" } });
    expect(screen.queryByText("Changes saved")).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save résumé" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(editor.value).toBe("Uploaded text");

    fireEvent.change(editor, { target: { value: "Ordinary edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Save résumé" }));
    await waitFor(() => expect(mocks.saveResumeSettings.mock.calls.length).toBeGreaterThanOrEqual(2));
    const laterForm = mocks.saveResumeSettings.mock.calls.at(-1)![1] as FormData;
    expect((laterForm.get("resume_pdf") as File).size).toBe(0);
  });
});
