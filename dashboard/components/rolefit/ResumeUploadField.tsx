"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
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
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <input
          ref={inputRef}
          name="resume_pdf"
          aria-label="Résumé PDF"
          type="file"
          accept="application/pdf"
          onChange={onChange}
          style={{
            position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px",
            overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Upload PDF
        </Button>
        <span style={{
          fontSize: "12.5px", color: fileName ? "var(--text-primary)" : "var(--text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>
          {fileName ?? "No file chosen"}
        </span>
      </div>
      <p role="status" aria-live="polite" style={{ minHeight: "17px", margin: 0, fontSize: "inherit", fontWeight: 500, color: "var(--text-secondary)" }}>{status}</p>
    </div>
  );
}
