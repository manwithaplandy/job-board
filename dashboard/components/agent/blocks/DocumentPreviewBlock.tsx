"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { safeHttpUrl } from "@/lib/rolefit/applyUrl";
import { downloadPdf } from "@/lib/rolefit/downloadPdf";
import { renderResumePdf } from "@/lib/rolefit/resumePdf";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { packageFields } from "./packageFields";
import { BlockFrame, Unavailable, own } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type DocumentPreview = Extract<V1Block, { type: "DocumentPreview" }>;

const ATS_NAMES: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};

/** "Apply on {ATS}" from the job's ats column; an unknown ATS reads as the company site. */
export function applyLabel(ats: string | null): string {
  const name = ats ? ATS_NAMES[ats.toLowerCase()] : undefined;
  return name ? `Apply on ${name}` : "Apply on the company site";
}

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, " ");

/** How long the Copy button reads "Copied" before it resets. */
export const COPIED_RESET_MS = 2_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsPDF is lazy-loaded untyped (lib/rolefit/downloadPdf.ts)
function renderLetterPdf(doc: any, text: string) {
  const width: number = doc.internal.pageSize.getWidth();
  const margin = 56;
  let y = 72;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(31, 36, 48);
  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      y += 10;
      continue;
    }
    for (const wrapped of doc.splitTextToSize(line, width - 2 * margin) as string[]) {
      if (y > 720) {
        doc.addPage();
        y = 72;
      }
      doc.text(wrapped, margin, y);
      y += 16;
    }
  }
}

function ResumePreview({ resume }: { resume: TailoredResume }) {
  return (
    <div className="rf-block-doc__page">
      <p className="rf-block-doc__name">{resume.name}</p>
      {resume.headline && <p className="rf-block-doc__headline">{resume.headline}</p>}
      {resume.contact && <p className="rf-block-doc__muted">{resume.contact}</p>}
      {resume.summary && <p className="rf-block-doc__text">{resume.summary}</p>}
      {resume.skills.length > 0 && <p className="rf-block-doc__text">{resume.skills.join(" · ")}</p>}
      {resume.experience.map((e, i) => (
        <div key={i} className="rf-block-doc__role">
          <p className="rf-block-doc__role-title">{`${e.role} · ${e.company}`}</p>
          {e.dates && <p className="rf-block-doc__muted">{e.dates}</p>}
          <ul className="rf-block-doc__bullets">
            {e.bullets.map((b, k) => (
              <li key={k}>{b}</li>
            ))}
          </ul>
        </div>
      ))}
      {resume.education.length > 0 && <p className="rf-block-doc__text">{resume.education.join(" · ")}</p>}
      {resume.certifications.length > 0 && <p className="rf-block-doc__text">{resume.certifications.join(" · ")}</p>}
    </div>
  );
}

/**
 * A generated document (spec 5(c) step 5): the tailored résumé or cover letter from the
 * job's package row, parsed with the package codec and shown as plain text, with fixed
 * controls only: Download PDF, Copy, "Apply on {ATS}" (href from the package's
 * apply_url) and Mark applied (emits application.set_stage). The product never submits.
 */
export function DocumentPreviewBlock({ block, gathered, rows, onIntent }: { block: DocumentPreview; gathered: GatheredData; rows: BlockRows; onIntent: OnIntent }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (copy !== "copied") return;
    const t = setTimeout(() => setCopy("idle"), COPIED_RESET_MS);
    return () => clearTimeout(t);
  }, [copy]);
  const job = own(gathered.jobs, block.jobId);
  const title = block.doc === "resume" ? "Tailored résumé" : "Cover letter";
  if (!job) {
    return (
      <BlockFrame title={title} className="rf-block-doc">
        <Unavailable />
      </BlockFrame>
    );
  }
  const view = rows.packages ? own(rows.packages, block.jobId) : null;
  const fields = packageFields(view);
  const text = block.doc === "resume" ? (fields.resume ? composeResumeText(fields.resume) : null) : fields.coverText;
  const applyHref = view?.applyUrl ? safeHttpUrl(view.applyUrl) : null;

  const download = async () => {
    if (text === null) return;
    if (block.doc === "resume" && fields.resume) {
      const resume = fields.resume;
      await downloadPdf(fileSafe(`Resume - ${job.company} - ${job.title}.pdf`), (doc) => renderResumePdf(doc, resume), text);
    } else {
      await downloadPdf(fileSafe(`Cover Letter - ${job.company} - ${job.title}.pdf`), (doc) => renderLetterPdf(doc, text), text);
    }
  };
  const copyText = async () => {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <BlockFrame title={`${title} for ${job.title} at ${job.company}`} className="rf-block-doc">
      {text === null ? (
        <p className="rf-block__unavailable">
          {block.doc === "resume" ? "No tailored résumé for this job yet." : "No cover letter for this job yet."}
        </p>
      ) : block.doc === "resume" && fields.resume ? (
        <ResumePreview resume={fields.resume} />
      ) : (
        <div className="rf-block-doc__page">
          <p className="rf-block-doc__text">{text}</p>
        </div>
      )}
      <div className="rf-block__actions">
        {text !== null && (
          <>
            <Button variant="outline" size="sm" onClick={() => void download()}>
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copyText()}>
              {copy === "copied" ? "Copied" : "Copy"}
            </Button>
          </>
        )}
        {applyHref && (
          <ButtonLink href={applyHref} size="sm" target="_blank" rel="noopener noreferrer">
            {applyLabel(view?.ats ?? null)}
          </ButtonLink>
        )}
        {view?.status === "applied" ? (
          <Badge tone="success">Applied</Badge>
        ) : (
          view && (
            <Button variant="ghost" size="sm" onClick={() => onIntent({ name: "application.set_stage", jobId: block.jobId, stage: "applied" })}>
              Mark applied
            </Button>
          )
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copy === "copied" ? "Copied to the clipboard." : ""}
      </span>
      {copy === "failed" && <p className="rf-block-prep__note">Copying didn&apos;t work here. Select the text instead.</p>}
    </BlockFrame>
  );
}
