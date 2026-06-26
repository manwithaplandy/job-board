"use client";

import type { JobRow } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";

// Build plain-text résumé from TailoredResume — mirrors composeResumeText in reference
function composeResumeText(job: JobRow, data: TailoredResume): string {
  let t = `${data.name}\n${data.headline}\n\n`;
  t += `TAILORED FOR: ${job.title} — ${job.company_name}\n\n`;
  t += `SUMMARY\n${data.summary}\n\nCORE SKILLS\n${data.skills.join(", ")}\n\nEXPERIENCE\n`;
  data.experience.forEach((exp) => {
    t += `${exp.role}, ${exp.company} (${exp.dates})\n`;
    exp.bullets.forEach((b) => { t += `  - ${b}\n`; });
    t += "\n";
  });
  t += `EDUCATION\n${data.education}\n`;
  return t;
}

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
  onGenerate: () => void;
  onRegenerate: () => void;
  /** Parent manages copiedId; call this to trigger the copy + label flip */
  onCopy: () => void;
  copyLabel: string;
  usingSample: boolean;
  onOpenProfile: () => void;
}

export function ResumePanel({
  job,
  isAuthed,
  state,
  data,
  error,
  onGenerate,
  onRegenerate,
  onCopy,
  copyLabel,
  usingSample,
  onOpenProfile,
}: ResumePanelProps) {
  const isIdle = !state || state === "idle";
  const isBusy = state === "busy";
  const isDone = state === "done";
  const isError = state === "error";

  // jsPDF download — dynamic import, mirrors reference download() layout
  const handleDownload = async () => {
    if (!data) return;
    const fname = `Resume - ${job.company_name} - ${job.title}.pdf`.replace(/[\\/:*?"<>|]/g, " ");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsPDFMod = (await import("jspdf")) as any;
      const JsPDF = jsPDFMod.jsPDF ?? jsPDFMod.default;
      const doc = new JsPDF({ unit: "pt", format: "letter" });
      const W: number = doc.internal.pageSize.getWidth();
      const M = 56;
      let y = 66;

      const wrap = (txt: string, w: number): string[] => doc.splitTextToSize(txt, w);

      // Name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(21);
      doc.setTextColor(22, 29, 41);
      doc.text(data.name, M, y);
      y += 17;

      // Headline
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(95, 100, 114);
      doc.text(data.headline, M, y);
      y += 24;

      // "TAILORED FOR" box
      doc.setFillColor(238, 243, 252);
      doc.roundedRect(M, y - 13, W - 2 * M, 25, 5, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(47, 92, 191);
      doc.text(`TAILORED FOR  —  ${job.title} at ${job.company_name}`, M + 11, y + 3);
      y += 38;

      const section = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(27, 35, 48);
        doc.text(title.toUpperCase(), M, y);
        y += 7;
        doc.setDrawColor(222, 227, 234);
        doc.line(M, y, W - M, y);
        y += 17;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(47, 56, 69);
      };

      section("Summary");
      wrap(data.summary, W - 2 * M).forEach((l: string) => { doc.text(l, M, y); y += 15; });
      y += 9;

      section("Core skills");
      wrap(data.skills.join("   ·   "), W - 2 * M).forEach((l: string) => { doc.text(l, M, y); y += 15; });
      y += 9;

      section("Experience");
      data.experience.forEach((exp) => {
        if (y > 700) { doc.addPage(); y = 66; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.8);
        doc.setTextColor(27, 35, 48);
        doc.text(`${exp.role}, ${exp.company}`, M, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(130, 136, 148);
        doc.text(exp.dates, W - M, y, { align: "right" });
        y += 15;
        doc.setFontSize(10.5);
        doc.setTextColor(47, 56, 69);
        exp.bullets.forEach((b) => {
          wrap("•  " + b, W - 2 * M - 8).forEach((l: string, i: number) => {
            doc.text(l, M + (i ? 12 : 6), y);
            y += 14;
          });
        });
        y += 9;
      });

      if (y > 710) { doc.addPage(); y = 66; }
      section("Education");
      doc.text(data.education, M, y);

      doc.save(fname);
    } catch {
      // Fall back to plain-text download
      const text = composeResumeText(job, data);
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname.replace(/\.pdf$/, ".txt");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    }
  };

  return (
    <div
      style={{
        marginTop: "24px",
        border: "1px solid #e3e7ee",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      {/* ── Anon: sign-in prompt ── */}
      {isAuthed === false && isIdle && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "17px 19px",
            background: "#f7f9fc",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
              Tailored résumé
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "#6b7480",
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
              color: "#fff",
              background: "#3b6fd4",
              border: "none",
              borderRadius: "11px",
              padding: "12px 20px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,111,212,.28)",
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
            background: "#f7f9fc",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1b2330" }}>
              Tailored résumé
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "#6b7480",
                marginTop: "3px",
                fontWeight: 500,
              }}
            >
              Generate a résumé focused on this exact role, ready to download.
            </div>
            {usingSample && (
              <div
                style={{ fontSize: "12px", color: "#9a7b3e", marginTop: "7px", fontWeight: 600 }}
              >
                Using a sample profile —{" "}
                <span
                  onClick={onOpenProfile}
                  style={{ color: "#3b6fd4", cursor: "pointer", textDecoration: "underline" }}
                >
                  add yours
                </span>{" "}
                for a sharper result.
              </div>
            )}
          </div>
          <button
            onClick={onGenerate}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
              fontSize: "14px",
              color: "#fff",
              background: "#3b6fd4",
              border: "none",
              borderRadius: "11px",
              padding: "12px 20px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,111,212,.28)",
            }}
          >
            <span style={{ fontSize: "15px" }}>✦</span>Generate résumé
          </button>
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
            background: "#f7f9fc",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "3px solid #e0e8f5",
              borderTopColor: "#3b6fd4",
              animation: "rf-spin .8s linear infinite",
              flex: "0 0 auto",
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
              Tailoring your résumé to {job.company_name}…
            </div>
            <div
              style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
            >
              Matching your background against this role&apos;s requirements.
            </div>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {isDone && data && (
        <div style={{ padding: "17px 19px", background: "#f6faf7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "6px",
                background: "#dcefe2",
                color: "#2f7d54",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              ✓
            </span>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#1b2330" }}>
              Résumé ready — tailored to {job.company_name}
            </div>
          </div>
          <div
            style={{
              marginTop: "12px",
              background: "#fff",
              border: "1px solid #e3e7ee",
              borderRadius: "12px",
              padding: "15px 16px",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#161d29" }}>{data.name}</div>
            <div
              style={{
                fontSize: "12.5px",
                color: "#5b6472",
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
              {data.skills.map((sk, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#3b6fd4",
                    background: "#eef3fc",
                    border: "1px solid #d8e2f6",
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
                color: "#fff",
                background: "#3b6fd4",
                border: "none",
                borderRadius: "10px",
                padding: "10px 17px",
                cursor: "pointer",
                boxShadow: "0 3px 10px rgba(59,111,212,.26)",
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
                color: "#5b6472",
                background: "#fff",
                border: "1px solid #dfe3ea",
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
              {copyLabel}
            </button>
            <button
              onClick={onRegenerate}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "#5b6472",
                background: "#fff",
                border: "1px solid #dfe3ea",
                borderRadius: "10px",
                padding: "10px 15px",
                cursor: "pointer",
              }}
            >
              <span>↻</span>Regenerate
            </button>
          </div>
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
            background: "#fdf6f5",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#b25a36" }}>
              Generation failed
            </div>
            {error && (
              <div
                style={{ fontSize: "12.5px", color: "#6b7480", marginTop: "3px", fontWeight: 500 }}
              >
                {error}
              </div>
            )}
          </div>
          <button
            onClick={onGenerate}
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
              fontSize: "14px",
              color: "#fff",
              background: "#3b6fd4",
              border: "none",
              borderRadius: "11px",
              padding: "12px 20px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(59,111,212,.28)",
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// Re-export for use in RolefitBoard copy handler
export { composeResumeText, legacyCopy };
