"use client";

import { useState, useTransition } from "react";

export interface ProfileModalProps {
  open: boolean;
  isAuthed: boolean;
  profileName?: string;
  onClose: () => void;
  saveResume: (fd: FormData) => Promise<void>;
}

export function ProfileModal({ open, isAuthed, onClose, saveResume }: ProfileModalProps) {
  const [profileTab, setProfileTab] = useState<"paste" | "upload">("paste");
  const [uploadName, setUploadName] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveResume(fd);
      onClose();
    });
  };

  const pasteActive = profileTab === "paste";

  const tabBg = (active: boolean) => (active ? "#fff" : "transparent");
  const tabColor = (active: boolean) => (active ? "#1f2430" : "#8a93a3");
  const tabShadow = (active: boolean) => (active ? "0 1px 4px rgba(0,0,0,.1)" : "none");

  return (
    <div
      onClick={onClose}
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "480px",
          maxWidth: "100%",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 30px 70px rgba(15,22,35,.4)",
          overflow: "hidden",
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
              Your profile
            </div>
            <div
              style={{
                fontSize: "12.5px",
                color: "#8a93a3",
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              Used to tailor résumés. Saved to your account.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "1px solid #e7eaf0",
              background: "#fff",
              color: "#8a93a3",
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
                    <div style={{ fontSize: "12px", color: "#8a93a3", fontWeight: 500 }}>
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
                    onChange={(e) => setUploadName(e.target.files?.[0]?.name ?? "")}
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
                  color: "#8a93a3",
                  fontWeight: 600,
                  textDecoration: "none",
                  marginRight: "auto",
                }}
              >
                Advanced settings →
              </a>
              <button
                type="button"
                onClick={onClose}
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
