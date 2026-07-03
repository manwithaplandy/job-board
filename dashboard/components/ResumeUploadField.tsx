"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

// A styled façade over a REAL <input type="file"> — the input stays a form field (visually
// hidden, not removed) so `saveProfile` still reads formData.get("resume_pdf") and the
// ProfileFormShell dirty-check (name:size) is unchanged. Only the presentation differs.
export function ResumeUploadField({
  name,
  accept,
  existingFileLabel,
}: {
  name: string;
  accept: string;
  existingFileLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const shown = fileName ?? existingFileLabel ?? "No file chosen";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <input
        ref={inputRef}
        name={name}
        type="file"
        accept={accept}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
        {shown}
      </span>
    </div>
  );
}
