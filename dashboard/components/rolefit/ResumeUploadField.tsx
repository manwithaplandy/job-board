"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

// Résumé upload as a review-before-commit INPUT METHOD: the file is POSTed to the
// authed /api/resume/extract route, converted to markdown, and dropped into the
// résumé textarea (`textareaId`) for the user to review before saving — resume_text
// is the source of truth, the uploaded file is archival. The real <input> stays a
// form field (visually hidden, name="resume_pdf") so `saveProfile` still archives it
// and the ProfileFormShell dirty-check (name:size) is unchanged; only the trigger is
// a styled Button, matching the board's résumé upload UX.
export function ResumeUploadField({ textareaId }: { textareaId: string }) {
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
      const ta = document.getElementById(textareaId) as HTMLTextAreaElement | null;
      if (ta) {
        ta.value = markdown;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
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
          fontSize: "12.5px", color: fileName ? "#1f2430" : "#8a93a3",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>
          {fileName ?? "No file chosen"}
        </span>
      </div>
      {status && (
        <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#6b7480" }}>{status}</span>
      )}
    </div>
  );
}
