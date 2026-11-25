"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/SystemStates";
import { AGENT_DOCUMENTS_MAX } from "@/lib/agent/request";
import { UPLOAD_ACCEPT, UPLOAD_FAILED, uploadErrorMessage } from "@/lib/uploadMessages";

export interface AttachedDocument {
  id: string;
  filename: string;
}

const uploadedSchema = z.object({ document: z.object({ id: z.uuid(), filename: z.string() }) });

/**
 * The composer's upload target (plan Task 1.20). A chosen file goes to POST
 * /api/agent/upload at once; the returned document id rides on the next message's
 * documentIds, and the loop checks it is the user's own. An upload error shows the fixed
 * message for its code, never the response's own text.
 */
export function AttachButton({
  attached,
  onAttach,
  onRemove,
  disabled = false,
}: {
  attached: AttachedDocument[];
  onAttach: (doc: AttachedDocument) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const full = attached.length >= AGENT_DOCUMENTS_MAX;

  const upload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/agent/upload", { method: "POST", body });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(uploadErrorMessage(z.object({ error: z.string() }).safeParse(json).data?.error));
        return;
      }
      const parsed = uploadedSchema.safeParse(json);
      if (!parsed.success) {
        setError(UPLOAD_FAILED);
        return;
      }
      onAttach({ id: parsed.data.document.id, filename: parsed.data.document.filename });
    } catch {
      setError(UPLOAD_FAILED);
    } finally {
      setBusy(false);
      setInputKey((k) => k + 1);
    }
  };

  return (
    <div className="rf-agent-attach">
      <FileUpload
        key={inputKey}
        label="Attach a file"
        visuallyHideLabel
        actionLabel={busy ? "Uploading" : "Attach a file"}
        emptyLabel={full ? `Up to ${AGENT_DOCUMENTS_MAX} files per message` : "No file attached"}
        announceFilename={false}
        accept={UPLOAD_ACCEPT}
        disabled={disabled || busy || full}
        onChange={(e) => void upload(e.currentTarget.files?.[0] ?? null)}
      />
      {attached.length > 0 && (
        <ul className="rf-agent-attach__list" aria-label="Attached files">
          {attached.map((d) => (
            <li key={d.id} className="rf-agent-attach__item">
              <span className="rf-agent-attach__name">{d.filename}</span>
              <Button variant="ghost" size="sm" onClick={() => onRemove(d.id)} disabled={disabled} aria-label={`Remove ${d.filename}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
