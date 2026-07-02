"use client";

import { useEffect, useRef, useState, useTransition } from "react";

export interface ProfileModalProps {
  open: boolean;
  isAuthed: boolean;
  hasProfile?: boolean;
  resumeText?: string;
  onClose: () => void;
  saveResume: (fd: FormData) => Promise<void>;
}

export function ProfileModal({
  open,
  isAuthed,
  hasProfile = false,
  resumeText = "",
  onClose,
  saveResume,
}: ProfileModalProps) {
  const [profileTab, setProfileTab] = useState<"paste" | "upload">("paste");
  const [uploadName, setUploadName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Save and restore focus
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the dialog after mount
      const timer = setTimeout(() => {
        dialogRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Close anyway?")) return;
    }
    setSaveError(null);
    setIsDirty(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await saveResume(fd);
        setIsDirty(false);
        onClose();
      } catch (err) {
        setSaveError((err as Error).message ?? "Save failed. Please try again.");
      }
    });
  };

  const pasteActive = profileTab === "paste";

  const tabBg = (active: boolean) => (active ? "#fff" : "transparent");
  const tabColor = (active: boolean) => (active ? "#1f2430" : "#6b7480");
  const tabShadow = (active: boolean) => (active ? "0 1px 4px rgba(0,0,0,.1)" : "none");

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,23,33,.46)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "24px",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={hasProfile ? "Edit profile" : "Set up profile"}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "480px",
          maxWidth: "100%",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 30px 70px rgba(15,22,35,.4)",
          overflow: "hidden",
          outline: "none",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "18px 20px",
            borderBottom: "1px solid #eef1f5",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#161d29" }}>
              {hasProfile ? "Edit profile" : "Set up profile"}
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "#6b7480",
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              Used to tailor résumés. Saved to your account.
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "1px solid #e7eaf0",
              background: "#fff",
              color: "#6b7480",
              fontSize: "16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        {!isAuthed ? (
          /* Anon: sign-in prompt */
          <div style={{ padding: "36px 20px 32px", textAlign: "center" }}>
            <div
              style={{
                fontSize: "14px",
                color: "#5b6472",
                marginBottom: "18px",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Sign in to save your résumé and get tailored matches.
            </div>
            <a
              href="/login"
              style={{
                display: "inline-block",
                fontWeight: 700,
                fontSize: "13.5px",
                color: "#fff",
                background: "#3b6fd4",
                borderRadius: "10px",
                padding: "10px 20px",
                cursor: "pointer",
                textDecoration: "none",
                boxShadow: "0 3px 10px rgba(59,111,212,.26)",
              }}
            >
              Sign in →
            </a>
          </div>
        ) : (
          /* Authed: paste/upload form */
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "18px 20px" }}>
              {/* Tab switcher */}
              <div
                style={{
                  display: "inline-flex",
                  background: "#eef1f5",
                  borderRadius: "10px",
                  padding: "3px",
                  width: "100%",
                }}
              >
                <button
                  type="button"
                  onClick={() => setProfileTab("paste")}
                  style={{
                    flex: 1,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "13px",
                    padding: "8px",
                    borderRadius: "8px",
                    background: tabBg(pasteActive),
                    color: tabColor(pasteActive),
                    boxShadow: tabShadow(pasteActive),
                  }}
                >
                  Paste text
                </button>
                <button
                  type="button"
                  onClick={() => setProfileTab("upload")}
                  style={{
                    flex: 1,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "13px",
                    padding: "8px",
                    borderRadius: "8px",
                    background: tabBg(!pasteActive),
                    color: tabColor(!pasteActive),
                    boxShadow: tabShadow(!pasteActive),
                  }}
                >
                  Upload PDF
                </button>
              </div>

              {/* Paste tab */}
              {pasteActive && (
                <>
                  <textarea
                    name="resume_text"
                    defaultValue={resumeText}
                    onChange={() => setIsDirty(true)}
                    placeholder="Paste your résumé or a few lines about your experience, skills, and roles…"
                    style={{
                      width: "100%",
                      height: "184px",
                      marginTop: "14px",
                      border: "1px solid #e3e7ee",
                      borderRadius: "12px",
                      padding: "13px",
                      fontSize: "13px",
                      lineHeight: 1.5,
                      color: "#1f2430",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                  <div
                    style={{
                      fontSize: "11.5px",
                      color: "#9aa3b0",
                      marginTop: "8px",
                      fontWeight: 500,
                    }}
                  >
                    Tip: start with your name on the first line. We&apos;ll detect skills
                    automatically.
                  </div>
                </>
              )}

              {/* Upload tab */}
              {!pasteActive && (
                <>
                  <label
                    htmlFor="rf-file"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "9px",
                      height: "184px",
                      marginTop: "14px",
                      border: "1.5px dashed #cdd5e0",
                      borderRadius: "12px",
                      cursor: "pointer",
                      background: "#f7f9fc",
                    }}
                  >
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "11px",
                        background: "#eef3fc",
                        color: "#3b6fd4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                      }}
                    >
                      ⤒
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#3b6fd4" }}>
                      Choose a PDF
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7480", fontWeight: 500 }}>
                      PDF, DOC or TXT — up to 5MB
                    </div>
                    {uploadName && (
                      <div
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#2f7d54",
                          marginTop: "2px",
                        }}
                      >
                        ✓ {uploadName}
                      </div>
                    )}
                  </label>
                  <input
                    id="rf-file"
                    type="file"
                    name="resume_pdf"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={(e) => {
                      setUploadName(e.target.files?.[0]?.name ?? "");
                      setIsDirty(true);
                    }}
                    style={{ display: "none" }}
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 20px 20px",
              }}
            >
              <a
                href="/profile"
                style={{
                  fontSize: "12.5px",
                  color: "#6b7480",
                  fontWeight: 600,
                  textDecoration: "none",
                  marginRight: "auto",
                }}
              >
                Advanced settings →
              </a>
              {saveError && (
                <p role="alert" style={{ margin: 0, fontSize: "12.5px", color: "#b25a36", fontWeight: 600 }}>
                  {saveError}
                </p>
              )}
              <button
                type="button"
                onClick={handleClose}
                style={{
                  fontWeight: 700,
                  fontSize: "13.5px",
                  color: "#5b6472",
                  background: "#fff",
                  border: "1px solid #dfe3ea",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  fontWeight: 700,
                  fontSize: "13.5px",
                  color: "#fff",
                  background: "#3b6fd4",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  cursor: isPending ? "not-allowed" : "pointer",
                  boxShadow: "0 3px 10px rgba(59,111,212,.26)",
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
