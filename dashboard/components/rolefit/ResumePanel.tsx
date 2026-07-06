"use client";

import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { renderResumePdf } from "@/lib/rolefit/resumePdf";
import { downloadPdf } from "@/lib/rolefit/downloadPdf";
import { composeResumeText } from "@/lib/rolefit/resumeText";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ResumeScorePanel } from "@/components/rolefit/ResumeScorePanel";

function legacyCopy(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    ta.remove();
  } catch {
    // ignore
  }
}

export interface ResumePanelProps {
  job: JobRow;
  isAuthed: boolean;
  /** undefined → idle; "busy" | "done" | "error" */
  state: string | undefined;
  data: TailoredResume | undefined;
  error?: string;
  /** True when the shown résumé was generated from an older profile version. */
  stale?: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  /** Parent manages copiedId; call this to trigger the copy + label flip */
  onCopy: () => void;
  copyLabel: string;
  usingSample: boolean;
  onOpenProfile: () => void;
  // Single generation lock for this job (résumé/cover/prepare) + cancel.
  generating?: boolean;
  onCancelGeneration?: () => void;
}

export function ResumePanel({
  job,
  isAuthed,
  state,
  data,
  error,
  stale,
  onGenerate,
  onRegenerate,
  onCopy,
  copyLabel,
  usingSample,
  onOpenProfile,
  generating,
  onCancelGeneration,
}: ResumePanelProps) {
  const isIdle = !state || state === "idle";
  const isBusy = state === "busy";
  const isDone = state === "done";
  const isError = state === "error";

  // jsPDF download — shared helper handles the dynamic import + .txt fallback.
  // Layout lives in lib/rolefit/resumePdf so it's shared with the CLI harness.
  const handleDownload = async () => {
    if (!data) return;
    const fname = `Resume - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
    await downloadPdf(fname, (doc) => renderResumePdf(doc, data), composeResumeText(data));
  };

  return (
    <Panel style={{ marginTop: "24px", padding: 0, overflow: "hidden" }}>
      {/* ── Anon: sign-in prompt ── */}
      {isAuthed === false && isIdle && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "17px 19px",
            background: "var(--bg-muted)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
              Tailored résumé
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                marginTop: "3px",
                fontWeight: 500,
              }}
            >
              Generate a résumé focused on this exact role, ready to download.
            </div>
          </div>
          <a
            href="/login"
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--text-on-accent)",
              background: "var(--accent)",
              border: "none",
              borderRadius: "11px",
              padding: "12px 20px",
              cursor: "pointer",
              boxShadow: "var(--shadow-accent)",
              textDecoration: "none",
            }}
          >
            Sign in to tailor a résumé
          </a>
        </div>
      )}

      {/* ── Idle (authed) ── */}
      {isAuthed !== false && isIdle && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "17px 19px",
            background: "var(--bg-muted)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>
              Tailored résumé
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                marginTop: "3px",
                fontWeight: 500,
              }}
            >
              Generate a résumé focused on this exact role, ready to download.
            </div>
            {usingSample && (
              <div
                style={{ fontSize: "12px", color: "var(--warning)", marginTop: "7px", fontWeight: 600 }}
              >
                Using a sample profile —{" "}
                <span
                  onClick={onOpenProfile}
                  style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                >
                  add yours
                </span>{" "}
                for a sharper result.
              </div>
            )}
          </div>
          <Button variant="primary" onClick={onGenerate} disabled={generating} style={{ flex: "0 0 auto" }}>
            <span style={{ fontSize: "15px" }}>✦</span>Generate résumé
          </Button>
        </div>
      )}

      {/* ── Busy ── */}
      {isBusy && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            padding: "21px 19px",
            background: "var(--bg-muted)",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "3px solid var(--accent-border)",
              borderTopColor: "var(--accent)",
              animation: "rf-spin .8s linear infinite",
              flex: "0 0 auto",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text-primary)" }}>
              Tailoring your résumé to {job.company_name}…
            </div>
            <div
              style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
            >
              Matching your background against this role&apos;s requirements. Usually about 30 seconds.
            </div>
          </div>
          {onCancelGeneration && (
            <button
              type="button"
              onClick={onCancelGeneration}
              style={{
                flex: "0 0 auto",
                fontWeight: 700,
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "9px",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {isDone && data && (
        <div style={{ padding: "17px 19px", background: "var(--success-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "6px",
                background: "var(--success-bg)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              ✓
            </span>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--text-primary)" }}>
              Résumé ready — tailored to {job.company_name}
            </div>
            {stale && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--warning)",
                  background: "var(--warning-bg)",
                  border: "1px solid var(--warning-border)",
                  borderRadius: "6px",
                  padding: "3px 8px",
                }}
              >
                Outdated — regenerate
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: "12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "15px 16px",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--text-primary)" }}>{data.name}</div>
            <div
              style={{
                fontSize: "12.5px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                marginTop: "6px",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {data.summary}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "11px" }}>
              {data.skills.map((sk) => (
                <span
                  key={sk}
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--accent)",
                    background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                  }}
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "13px" }}>
            <button
              onClick={handleDownload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "var(--text-on-accent)",
                background: "var(--accent)",
                border: "none",
                borderRadius: "10px",
                padding: "10px 17px",
                cursor: "pointer",
                boxShadow: "var(--shadow-accent-md)",
              }}
            >
              <span>⤓</span>Download PDF
            </button>
            <button
              onClick={onCopy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "var(--text-secondary)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "10px 15px",
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M3 11V3.6C3 2.7 3.7 2 4.6 2H11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <span aria-live="polite">{copyLabel}</span>
            </button>
            <button
              onClick={onRegenerate}
              disabled={generating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "var(--text-secondary)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "10px 15px",
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.6 : 1,
              }}
            >
              <span>↻</span>Regenerate
            </button>
          </div>
          <ResumeScorePanel job={job} resume={data} isAuthed={isAuthed} />
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "17px 19px",
            background: "var(--danger-bg)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "var(--danger)" }}>
              Generation failed
            </div>
            {error && (
              <div
                style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "3px", fontWeight: 500 }}
              >
                {error}
              </div>
            )}
          </div>
          <Button variant="primary" onClick={onGenerate} disabled={generating} style={{ flex: "0 0 auto" }}>
            Retry
          </Button>
        </div>
      )}
    </Panel>
  );
}

// Re-export for use in RolefitBoard copy handler
export { legacyCopy };
export { composeResumeText } from "@/lib/rolefit/resumeText";
