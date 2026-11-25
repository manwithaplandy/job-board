"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDocumentAction,
  restoreResumeVersionAction,
  useAsResumeAction as replaceResumeWithDocument,
  type DocumentActionResult,
} from "@/app/actions/documents";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FormControls";
import { Badge } from "@/components/ui/Panel";
import { Alert } from "@/components/ui/SystemStates";
import type { GeneratedDocuments } from "@/lib/workspaces/generatedDocuments";
import type { ResumeVersion } from "@/lib/workspaces/resumeVersions";
import type { DocumentMeta } from "@/lib/workspaces/types";

const UPLOAD_ERRORS: Record<string, string> = {
  too_large: "That file is larger than 4 MB.",
  empty: "That file is empty.",
  type_not_allowed: "Upload a PDF, PNG, JPEG, WebP, plain-text or Markdown file.",
  type_mismatch: "That file's contents do not match its type.",
  budget: "Reading text from images is paused: your agent budget is used up for now.",
  subscription_required: "Uploads need an active plan.",
};
const UPLOAD_FAILED = "That upload did not go through. Try again.";

const EXTRACTION: Record<DocumentMeta["extraction"], { label: string; tone: "success" | "warning" | "danger"; note: string | null }> = {
  ok: { label: "Text read", tone: "success", note: null },
  empty: { label: "No readable text", tone: "warning", note: "This file had no readable text, so it cannot be used as your résumé." },
  failed: { label: "Text could not be read", tone: "danger", note: "Its text could not be read, so it cannot be used as your résumé." },
};

const VERSION_SOURCE: Record<ResumeVersion["source"], string> = {
  upload: "Replaced when you used an upload",
  agent: "Replaced by the agent",
  restore: "Replaced by a restore",
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const day = (iso: string) => iso.slice(0, 10);

type Confirming = { kind: "use" | "delete"; id: string } | { kind: "restore"; version: number } | null;

/**
 * The documents library (plan Task 1.11): the résumé source of truth with its earlier
 * versions (Restore), the user's uploads with their text-extraction state (Use as
 * résumé, Delete), and the generated résumés and cover letters per job. Every write
 * that replaces the résumé or deletes a file asks in the page first.
 */
export function DocumentsPage({
  resume,
  versions,
  documents,
  generated,
}: {
  resume: { text: string | null; updatedAt: string | null };
  versions: ResumeVersion[];
  documents: DocumentMeta[];
  generated: GeneratedDocuments[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const run = (work: () => Promise<DocumentActionResult>, done: string) =>
    startTransition(async () => {
      setMessage(null);
      try {
        const out = await work();
        setConfirming(null);
        if (!out.ok) {
          setMessage({ tone: "danger", text: out.message });
          return;
        }
        setMessage({ tone: "success", text: done });
        router.refresh();
      } catch {
        setMessage({ tone: "danger", text: "That change could not be saved. Try again." });
      }
    });

  const upload = () => {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/agent/upload", { method: "POST", body });
        if (!res.ok) {
          const code = await res.json().then((j: { error?: unknown }) => (typeof j.error === "string" ? j.error : ""), () => "");
          setMessage({ tone: "danger", text: UPLOAD_ERRORS[code] ?? UPLOAD_FAILED });
          return;
        }
        setFile(null);
        setUploadKey((k) => k + 1);
        setMessage({ tone: "success", text: `Uploaded ${file.name}.` });
        router.refresh();
      } catch {
        setMessage({ tone: "danger", text: UPLOAD_FAILED });
      }
    });
  };

  return (
    <div className="rf-ws-board">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <section className="rf-ws-section" aria-labelledby="ws-docs-resume">
        <h2 id="ws-docs-resume" className="rf-ws-section__title">
          Your résumé
        </h2>
        <div className="rf-ws-row">
          {resume.text ? (
            <>
              <p className="rf-ws-row__meta">
                The source of truth for reviews and generated documents.
                {resume.updatedAt ? ` Profile last saved ${day(resume.updatedAt)}.` : ""}
              </p>
              <details className="rf-ws-disclosure">
                <summary className="rf-ws-disclosure__summary">Show résumé text</summary>
                <p className="rf-ws-docs__text">{resume.text}</p>
              </details>
            </>
          ) : (
            <p className="rf-ws-section__empty">No résumé yet. Upload one below, or add it on your profile.</p>
          )}
        </div>
        {versions.length > 0 && (
          <ol className="rf-ws-versions" aria-label="Earlier résumés">
            {versions.map((v) => (
              <li key={v.version} className="rf-ws-versions__item">
                <div className="rf-ws-versions__head">
                  <span className="rf-ws-versions__title">Version {v.version}</span>
                  <span className="rf-ws-history__meta">
                    {VERSION_SOURCE[v.source]} · <time dateTime={v.createdAt}>{day(v.createdAt)}</time>
                  </span>
                  {confirming?.kind === "restore" && confirming.version === v.version ? null : (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirming({ kind: "restore", version: v.version })}>
                      Restore
                    </Button>
                  )}
                </div>
                {confirming?.kind === "restore" && confirming.version === v.version && (
                  <div className="rf-ws-confirm">
                    <p className="rf-ws-confirm__text">Make this version your résumé again? Your current résumé is kept as an earlier version.</p>
                    <div className="rf-ws-row__actions">
                      <Button size="sm" disabled={pending} onClick={() => run(() => restoreResumeVersionAction(v.version), `Version ${v.version} is your résumé again.`)}>
                        Restore this version
                      </Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <details className="rf-ws-disclosure">
                  <summary className="rf-ws-disclosure__summary">Show text</summary>
                  <p className="rf-ws-docs__text">{v.text}</p>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rf-ws-section" aria-labelledby="ws-docs-uploads">
        <h2 id="ws-docs-uploads" className="rf-ws-section__title">
          Uploads <span className="rf-ws-section__count">{documents.length}</span>
        </h2>
        <div className="rf-ws-docs__upload">
          <FileUpload
            key={uploadKey}
            label="Add a file"
            description="PDF, PNG, JPEG, WebP, plain text or Markdown, up to 4 MB. Text in images is read by the agent and counts toward its budget."
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/markdown"
            disabled={pending}
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
          />
          <Button disabled={pending || file === null} onClick={upload} loading={pending && file !== null} loadingLabel="Uploading">
            Upload
          </Button>
        </div>
        {documents.length === 0 ? (
          <p className="rf-ws-section__empty">No uploads yet.</p>
        ) : (
          <div className="rf-ws-list">
            {documents.map((d) => {
              const state = EXTRACTION[d.extraction];
              const titleId = `ws-doc-${d.id}`;
              const confirmUse = confirming?.kind === "use" && confirming.id === d.id;
              const confirmDelete = confirming?.kind === "delete" && confirming.id === d.id;
              return (
                <article key={d.id} className="rf-ws-row" aria-labelledby={titleId}>
                  <div className="rf-ws-row__head">
                    <div className="rf-ws-row__title">
                      <p id={titleId} className="rf-ws-docs__name">
                        {d.filename}
                      </p>
                      <p className="rf-ws-row__meta">
                        {sizeLabel(d.bytes)} · Uploaded <time dateTime={d.createdAt}>{day(d.createdAt)}</time>
                      </p>
                    </div>
                    <div className="rf-ws-row__badges">
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </div>
                  </div>
                  {state.note && <p className="rf-ws-row__reason-text">{state.note}</p>}
                  {confirmUse && (
                    <div className="rf-ws-confirm">
                      <p className="rf-ws-confirm__text">
                        Replace your résumé with the text from {d.filename}? Your current résumé is kept as an earlier version.
                      </p>
                      <div className="rf-ws-row__actions">
                        <Button size="sm" disabled={pending} onClick={() => run(() => replaceResumeWithDocument(d.id), `${d.filename} is now your résumé.`)}>
                          Replace résumé
                        </Button>
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {confirmDelete && (
                    <div className="rf-ws-confirm">
                      <p className="rf-ws-confirm__text">Delete {d.filename}? This cannot be undone.</p>
                      <div className="rf-ws-row__actions">
                        <Button variant="destructive" size="sm" disabled={pending} onClick={() => run(() => deleteDocumentAction(d.id), `Deleted ${d.filename}.`)}>
                          Delete permanently
                        </Button>
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {!confirmUse && !confirmDelete && (
                    <div className="rf-ws-row__actions">
                      {d.extraction === "ok" && (
                        <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirming({ kind: "use", id: d.id })}>
                          Use as résumé
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming({ kind: "delete", id: d.id })}>
                        Delete
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rf-ws-section" aria-labelledby="ws-docs-generated">
        <h2 id="ws-docs-generated" className="rf-ws-section__title">
          Generated for jobs <span className="rf-ws-section__count">{generated.length}</span>
        </h2>
        {generated.length === 0 ? (
          <p className="rf-ws-section__empty">No tailored résumés or cover letters yet. Prepare an application from the board.</p>
        ) : (
          <ul className="rf-ws-list rf-ws-docs__generated" aria-label="Generated documents">
            {generated.map((g) => (
              <li key={g.job.jobId} className="rf-ws-row">
                <div className="rf-ws-row__head">
                  <div className="rf-ws-row__title">
                    <a className="rf-secondary-link" href={g.job.url} target="_blank" rel="noopener noreferrer">
                      {g.job.title}
                    </a>
                    <p className="rf-ws-row__meta">
                      {g.job.company} · Prepared <time dateTime={g.preparedAt}>{day(g.preparedAt)}</time>
                      {g.status === "applied" ? " · Applied" : ""}
                    </p>
                  </div>
                  <div className="rf-ws-row__badges">
                    {g.resume && <Badge tone="success">Résumé</Badge>}
                    {g.cover && <Badge tone="success">Cover letter</Badge>}
                    {g.outdated && <Badge tone="warning">Outdated</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
