// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProfileRow } from "@/lib/types";
import { ResumeSettingsForm } from "./ResumeSettingsForm";

vi.mock("@/app/actions/profileSettings", () => ({ saveResumeSettings: vi.fn() }));

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
});
