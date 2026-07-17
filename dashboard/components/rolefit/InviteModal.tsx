"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/admin/CopyButton";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/Action";
import { Icon } from "@/components/ui/Icon";
import { TextArea } from "@/components/ui/FormControls";
import { Alert } from "@/components/ui/SystemStates";
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

// Overlay + card visuals mirror ProfileModal (same backdrop token, z-index, radius, and
// modal shadow) so the two house dialogs read as one system; only the inner layout differs.
// Geometry and color live in the shared .rf-invite-* classes (board.css) — no inline
// geometry, no raw theme values.

// Mount gate: the dialog content mounts fresh on each open, so every useState initial
// value IS the per-open reset (no synchronous setState-in-effect and no cascading
// renders), and unmounting on close tears every listener down. Public API unchanged.
export function InviteModal({ open, onClose }: InviteModalProps) {
  if (!open) return null;
  return <InviteModalContent onClose={onClose} />;
}

const resultClass = (s: SendResult["status"]) =>
  s === "sent"
    ? "rf-invite-result__status rf-invite-result__status--sent"
    : s === "failed"
      ? "rf-invite-result__status rf-invite-result__status--failed"
      : "rf-invite-result__status rf-invite-result__status--skipped";

function InviteModalContent({ onClose }: { onClose: () => void }) {
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

  // On mount (= each open): remember the opener, fetch the allowance, focus the dialog;
  // unmount (= close) restores focus to the opener.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
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
  }, []);

  // Escape closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap — keep Tab within the dialog while it's open (aria-modal promises this;
  // same focusables query + shift/Tab wraparound semantics as ProfileModal). The
  // offsetParent filter drops hidden elements; shift+Tab from the dialog root itself
  // (initial focus, tabIndex=-1) wraps to the last focusable just like from the first.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

  const sendDisabled = zero || !ready?.emailConfigured || busy !== null || emails.trim() === "" || overRemaining;

  return (
    <div
      className="rf-invite-overlay"
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
        className="rf-invite-card"
      >
        <div className="rf-invite-header">
          <h2 className="rf-invite-title">Invite someone to Rolefit</h2>
          <IconButton label="Close" icon="close" onClick={onClose} />
        </div>

        {status.state === "loading" && <div className="rf-invite-muted">Loading…</div>}
        {status.state === "error" && (
          <Alert tone="danger">{status.error}</Alert>
        )}

        {ready && (
          <>
            <div className="rf-invite-count">
              {remaining} of {ready.granted} invites left
            </div>
            {zero && (
              <p className="rf-invite-zero">You&apos;ve used all your invites.</p>
            )}

            <div className="rf-invite-section">
              <TextArea
                id="invite-emails"
                label="Email addresses"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                disabled={zero || !ready.emailConfigured || busy !== null}
                rows={3}
                placeholder="friend@example.com, colleague@example.com"
              />
              <div className="rf-invite-send-row">
                <Button
                  onClick={doSend}
                  disabled={sendDisabled}
                >
                  {busy === "send" ? "Sending…" : "Send invites"}
                </Button>
                <span className={overRemaining ? "rf-invite-hint rf-invite-hint--warn" : "rf-invite-hint"}>
                  {overRemaining
                    ? `You can send ${remaining} more.`
                    : "Each address spends one invite; codes expire in 30 days."}
                </span>
              </div>
              {!ready.emailConfigured && (
                <p className="rf-invite-note">
                  Email sending isn&apos;t configured yet — generate a code below and share it yourself.
                </p>
              )}
              {results && (
                <ul className="rf-invite-results">
                  {results.map((r) => (
                    <li key={r.email} className="rf-invite-result">
                      <span className="rf-invite-result__email">{r.email}</span>{" "}
                      <span className={resultClass(r.status)}>
                        {r.status === "sent" ? (
                          <Icon name="check" size={16} />
                        ) : r.status === "failed" ? (
                          <Icon name="close" size={16} />
                        ) : (
                          "—"
                        )}{" "}
                        {r.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div role="separator" className="rf-invite-divider" />

            <div>
              <div className="rf-invite-eyebrow">Or share a code yourself</div>
              <Button
                variant="secondary"
                onClick={doGenerate}
                disabled={zero || busy !== null}
              >
                {busy === "generate" ? "Generating…" : "Generate code"}
              </Button>
              {minted && (
                <div className="rf-invite-minted">
                  <div className="rf-invite-minted__row">
                    <span className="rf-invite-code">{minted.code}</span>
                    <CopyButton text={minted.code} />
                  </div>
                  <div className="rf-invite-minted__row">
                    <span className="rf-invite-url">{minted.link}</span>
                    <CopyButton text={minted.link} />
                  </div>
                  <div className="rf-invite-note">Single-use · expires in 30 days</div>
                </div>
              )}
            </div>
          </>
        )}

        {actionError && (
          <Alert tone="danger" className="rf-invite-error">{actionError}</Alert>
        )}
      </div>
    </div>
  );
}
