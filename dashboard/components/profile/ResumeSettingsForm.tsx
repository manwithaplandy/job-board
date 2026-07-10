"use client";

import { useState } from "react";
import { saveResumeSettings } from "@/app/actions/profileSettings";
import type { ProfileRow } from "@/lib/types";
import { ResumeUploadField } from "@/components/rolefit/ResumeUploadField";
import { SectionFormShell } from "./SectionFormShell";

export function ResumeSettingsForm({ profile }: { profile: ProfileRow }) {
  const initialText = profile.resume_text ?? "";
  const [resumeText, setResumeText] = useState(initialText);
  const [savedResumeText, setSavedResumeText] = useState(initialText);
  const [reviewing, setReviewing] = useState(false);
  const archiveName = profile.resume_file_path?.split("/").filter(Boolean).at(-1);

  return (
    <SectionFormShell
      action={saveResumeSettings}
      submitLabel="Save résumé"
      onReset={(values) => {
        const restored = values.get("resume_text");
        if (typeof restored === "string") setResumeText(restored);
      }}
      onSaved={(values) => {
        const saved = values.get("resume_text");
        if (typeof saved === "string") setSavedResumeText(saved);
      }}
    >
      <section aria-labelledby="resume-summary-heading" className="settings-card">
        <h2 id="resume-summary-heading">Reviewed résumé text powers matching</h2>
        <p>Rolefit uses the reviewed text below for matching and application writing. The PDF is kept only as an archive.</p>
        <dl>
          <div><dt>Archived PDF</dt><dd>{archiveName ?? "No PDF archived"}</dd></div>
          <div><dt>Last updated</dt><dd><time dateTime={profile.updated_at}>{new Date(profile.updated_at).toLocaleDateString()}</time></dd></div>
        </dl>
      </section>

      <section aria-labelledby="resume-upload-heading">
        <h2 id="resume-upload-heading">Upload or replace PDF archive</h2>
        <ResumeUploadField
          textareaId="resume_text"
          hasUnsavedText={resumeText !== savedResumeText}
          onExtracted={(markdown) => setResumeText(markdown)}
        />
      </section>

      <section aria-labelledby="resume-review-heading">
        <h2 id="resume-review-heading">Experience source</h2>
        <button type="button" aria-expanded={reviewing} aria-controls="resume-review-editor" onClick={() => setReviewing((value) => !value)}>
          {reviewing ? "Hide reviewed text" : "Review extracted text"}
        </button>
        {reviewing ? (
          <div id="resume-review-editor" className="settings-field">
            <label htmlFor="resume_text">Reviewed résumé text</label>
            <textarea id="resume_text" name="resume_text" value={resumeText} onChange={(event) => setResumeText(event.target.value)} rows={16} />
          </div>
        ) : (
          <input type="hidden" name="resume_text" value={resumeText} />
        )}
      </section>
    </SectionFormShell>
  );
}
