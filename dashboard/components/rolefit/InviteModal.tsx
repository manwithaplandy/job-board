"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import {
  generateInviteCodeAction,
  getInviteStatusAction,
  sendInvitesAction,
  type SendResult,
} from "@/app/actions/userInvites";

export interface InviteModalProps {
  open: boolean;
  onClose: () => void;
}

type Status =
  | { state: "loading" }
  | { state: "error"; error: string }
  | { state: "ready"; remaining: number; granted: number; emailConfigured: boolean };

// Overlay + card visuals mirror ProfileModal.tsx (same backdrop tint, z-index, padding,
// radius, and shadow) so the two house dialogs read as one system; only the inner layout
// differs. Design tokens only — no Tailwind, no external stylesheet.
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "rgba(17,23,33,.46)", padding: "24px",
};
const cardStyle: React.CSSProperties = {
  width: "440px", maxWidth: "100%", maxHeight: "min(640px, calc(100vh - 48px))",
  overflowY: "auto", background: "var(--bg-surface)", borderRadius: "18px",
  border: "1px solid var(--border)", boxShadow: "0 30px 70px rgba(15,22,35,.4)",
  padding: "24px", outline: "none",
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "6px",
};
const primaryBtnStyle: React.CSSProperties = {
  border: "none", borderRadius: "9px", padding: "9px 16px", fontSize: "13px",
  fontWeight: 700, color: "var(--text-on-accent)", background: "var(--accent)",
  boxShadow: "var(--shadow-accent)", cursor: "pointer", fontFamily: "inherit",
};
const mutedTextStyle: React.CSSProperties = {
  fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5,
};

export function InviteModal({ open, onClose }: InviteModalProps) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState<"send" | "generate" | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [minted, setMinted] = useState<{ code: string; link: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Guards overlay click-through: dismiss only when BOTH pointer-down and click land on
  // the backdrop itself (matches ProfileModal — a text-drag that ends off the card must
  // not close the dialog).
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  // Fetch allowance on each open; reset transient state on close.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    setStatus({ state: "loading" });
    setResults(null);
    setMinted(null);
    setActionError(null);
    setEmails("");
    let cancelled = false;
    getInviteStatusAction().then((r) => {
      if (cancelled) return;
      setStatus(r.ok
        ? { state: "ready", remaining: r.remaining, granted: r.granted, emailConfigured: r.emailConfigured }
        : { state: "error", error: r.error });
    });
    const timer = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const ready = status.state === "ready" ? status : null;
  const remaining = ready?.remaining ?? 0;
  const zero = ready !== null && remaining === 0;
  // Client-side count guard (spec: "Send disabled when … count > remaining"). The
  // action re-enforces via the atomic spend — this is UX, not the control.
  const addressCount = emails.split(/[\s,;]+/).filter(Boolean).length;
  const overRemaining = addressCount > remaining;

  const doSend = async () => {
    setBusy("send");
    setActionError(null);
    setResults(null);
    try {
      const r = await sendInvitesAction(emails);
      if (!r.ok) {
        setActionError(r.error);
      } else {
        setResults(r.results);
        setEmails("");
        if (ready) setStatus({ ...ready, remaining: r.remaining });
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const doGenerate = async () => {
    setBusy("generate");
    setActionError(null);
    try {
      const r = await generateInviteCodeAction();
      if (!r.ok) {
        setActionError(r.error);
      } else {
        setMinted({ code: r.code, link: r.link });
        if (ready) setStatus({ ...ready, remaining: r.remaining });
      }
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const resultColor = (s: SendResult["status"]) =>
    s === "sent" ? "var(--accent)" : s === "failed" ? "var(--danger)" : "var(--text-secondary)";

  return (
    <div
      style={overlayStyle}
      onMouseDown={(e) => { mouseDownTargetRef.current = e.target; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Invite someone to Rolefit"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--text-primary)" }}>
            Invite someone to Rolefit
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ border: "none", background: "transparent", color: "var(--text-secondary)",
                     fontSize: "18px", cursor: "pointer", padding: "2px 6px", fontFamily: "inherit" }}
          >
            ×
          </button>
        </div>

        {status.state === "loading" && <div style={mutedTextStyle}>Loading…</div>}
        {status.state === "error" && (
          <p role="alert" style={{ ...mutedTextStyle, color: "var(--danger)", fontWeight: 600 }}>{status.error}</p>
        )}

        {ready && (
          <>
            <div style={{ ...mutedTextStyle, marginBottom: "16px", fontWeight: 600 }}>
              {remaining} of {ready.granted} invites left
            </div>
            {zero && (
              <p style={{ ...mutedTextStyle, fontWeight: 600, color: "var(--text-primary)" }}>
                You&apos;ve used all your invites.
              </p>
            )}

            <div style={{ marginBottom: "18px" }}>
              <label htmlFor="invite-emails" style={sectionLabelStyle}>Email addresses</label>
              <textarea
                id="invite-emails"
                aria-label="Email addresses"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                disabled={zero || !ready.emailConfigured || busy !== null}
                rows={3}
                placeholder="friend@example.com, colleague@example.com"
                style={{
                  width: "100%", boxSizing: "border-box", fontSize: "13px", fontFamily: "inherit",
                  color: "var(--text-primary)", background: "var(--bg-muted)",
                  border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 11px",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={doSend}
                  disabled={zero || !ready.emailConfigured || busy !== null || emails.trim() === "" || overRemaining}
                  style={{ ...primaryBtnStyle, opacity: zero || !ready.emailConfigured || emails.trim() === "" || overRemaining ? 0.6 : 1 }}
                >
                  {busy === "send" ? "Sending…" : "Send invites"}
                </button>
                <span style={{ fontSize: "11.5px", color: overRemaining ? "var(--danger)" : "var(--text-muted)" }}>
                  {overRemaining
                    ? `You can send ${remaining} more.`
                    : "Each address spends one invite; codes expire in 30 days."}
                </span>
              </div>
              {!ready.emailConfigured && (
                <p style={{ ...mutedTextStyle, marginTop: "8px" }}>
                  Email sending isn&apos;t configured yet — generate a code below and share it yourself.
                </p>
              )}
              {results && (
                <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                  {results.map((r) => (
                    <li key={r.email} style={{ fontSize: "12.5px", padding: "3px 0" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.email}</span>{" "}
                      <span style={{ color: resultColor(r.status) }}>
                        {r.status === "sent" ? "✓" : r.status === "failed" ? "✗" : "—"} {r.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div role="separator" style={{ borderTop: "1px solid var(--bg-muted)", margin: "14px 0" }} />

            <div>
              <div style={sectionLabelStyle}>Or share a code yourself</div>
              <button
                type="button"
                onClick={doGenerate}
                disabled={zero || busy !== null}
                style={{
                  ...primaryBtnStyle, background: "var(--bg-muted)", color: "var(--text-primary)",
                  boxShadow: "none", border: "1px solid var(--border)",
                  opacity: zero ? 0.6 : 1,
                }}
              >
                {busy === "generate" ? "Generating…" : "Generate code"}
              </button>
              {minted && (
                <div
                  style={{
                    marginTop: "10px", background: "var(--accent-bg)",
                    border: "1px solid var(--accent-border)", borderRadius: "10px", padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                   fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
                      {minted.code}
                    </span>
                    <CopyButton text={minted.code} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
                    <span style={{ fontSize: "11.5px", color: "var(--text-secondary)",
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {minted.link}
                    </span>
                    <CopyButton text={minted.link} />
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                    Single-use · expires in 30 days
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {actionError && (
          <p role="alert" style={{ ...mutedTextStyle, color: "var(--danger)", fontWeight: 600, marginTop: "12px" }}>
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
}
