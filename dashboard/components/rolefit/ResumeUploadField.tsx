"use client";
import { useState } from "react";
import { FileUpload } from "@/components/ui/FormControls";

// Résumé upload as a review-before-commit INPUT METHOD: the file is POSTed to the
// authed /api/resume/extract route, converted to markdown, and dropped into the
// résumé textarea (`textareaId`) for the user to review before saving — resume_text
// is the source of truth, the uploaded file is archival. The real <input> stays a
// form field (visually hidden, name="resume_pdf") so `saveProfile` still archives it
// and the form's file dirty-check (name:size) is unchanged; only the trigger is
// a styled Button, matching the board's résumé upload UX.
interface ResumeUploadFieldProps {
  textareaId: string;
  onExtracted?: (markdown: string) => void;
  hasUnsavedText?: boolean;
}

export function ResumeUploadField({ textareaId, onExtracted, hasUnsavedText = false }: ResumeUploadFieldProps) {
  const [status, setStatus] = useState<string>("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Extracting…");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/resume/extract", { method: "POST", body });
      if (!res.ok) {
        setStatus("Couldn't read that file — paste your résumé text below instead.");
        return;
      }
      const { markdown } = (await res.json()) as { markdown: string };
      if (typeof markdown !== "string") {
        setStatus("Couldn't read that file — paste your résumé text below instead.");
        return;
      }
      if (hasUnsavedText && !window.confirm("Replace your unsaved résumé edits with the extracted PDF text?")) {
        setStatus("Extraction ready — your unsaved résumé edits were kept.");
        return;
      }
      if (onExtracted) {
        onExtracted(markdown);
      } else {
        const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
        if (ta) {
          ta.value = markdown;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      setStatus("Extracted — review the text below, then Save.");
    } catch {
      setStatus("Couldn't read that file — paste your résumé text below instead.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <FileUpload
        label="Résumé PDF"
        visuallyHideLabel
        announceFilename={false}
        name="resume_pdf"
        accept="application/pdf"
        actionLabel="Upload PDF"
        emptyLabel="No file chosen"
        nameClassName="resume-upload-filename"
        onChange={onChange}
      />
      <p className="resume-upload-status" role="status" aria-live="polite" style={{ minHeight: "17px", margin: 0, fontWeight: 500, color: "var(--text-secondary)" }}>{status}</p>
    </div>
  );
}
