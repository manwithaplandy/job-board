"use client";
import { useState } from "react";

export function ResumeUploadField({ textareaId }: { textareaId: string }) {
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
    <>
      <input
        name="resume_pdf"
        type="file"
        accept="application/pdf"
        onChange={onChange}
        style={{ fontSize: "13px", color: "#5b6472" }}
      />
      {status && <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#6b7480", marginTop: "6px" }}>{status}</span>}
    </>
  );
}
