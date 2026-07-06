"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInviteAction } from "@/app/actions/invites";
import { CopyButton } from "./CopyButton";

// Admin invite-minting form (rendered inside the isAdmin-gated /admin/invites page;
// the server action re-gates independently). On success it shows the minted code
// with a copy affordance and router.refresh()es so the server-rendered list below
// picks up the new row.

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: ".4px",
  marginBottom: "4px",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "13px",
  color: "var(--text-primary)",
  background: "var(--bg-muted)",
  border: "1px solid var(--border)",
  borderRadius: "9px",
  padding: "8px 10px",
  fontFamily: "inherit",
};

export function InviteGenerator() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expires, setExpires] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMinted(null);
    try {
      const res = await createInviteAction({
        note: note.trim() || undefined,
        maxUses: Number(maxUses) || 1, // empty / 0 / NaN → default 1 (server rejects 0)
        expiresAt: expires || null,
        code: customCode.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setMinted(res.code);
        // Reset the whole form so the next mint starts from defaults rather than
        // silently inheriting the previous expiry / max-uses.
        setNote("");
        setCustomCode("");
        setExpires("");
        setMaxUses("1");
        router.refresh(); // re-render the server list below with the new code
      }
    } catch {
      // The gate throws (redacted in prod) and network failures land here too.
      setError("Couldn't create the invite. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px", minWidth: "180px" }}>
          <label htmlFor="invite-note" style={labelStyle}>Note</label>
          <input
            id="invite-note"
            type="text"
            value={note}
            maxLength={200}
            placeholder="Who is this for?"
            onChange={(e) => setNote(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: "0 0 110px" }}>
          <label htmlFor="invite-max-uses" style={labelStyle}>Max uses</label>
          <input
            id="invite-max-uses"
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label htmlFor="invite-expires" style={labelStyle}>Expires</label>
          <input
            id="invite-expires"
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{
            border: "none",
            borderRadius: "9px",
            padding: "9px 16px",
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--text-on-accent)",
            background: "var(--accent)",
            boxShadow: "var(--shadow-accent)",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          {busy ? "Generating…" : "Generate invite"}
        </button>
      </div>

      {showCustom ? (
        <div style={{ marginTop: "10px", maxWidth: "280px" }}>
          <label htmlFor="invite-custom-code" style={labelStyle}>Custom code</label>
          <input
            id="invite-custom-code"
            type="text"
            value={customCode}
            placeholder="e.g. TEAM-2026"
            onChange={(e) => setCustomCode(e.target.value)}
            style={inputStyle}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          style={{
            marginTop: "10px",
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          Use a custom code
        </button>
      )}

      {error && (
        <div style={{ marginTop: "10px", fontSize: "12.5px", color: "var(--danger)" }}>{error}</div>
      )}

      {minted && (
        <div
          style={{
            marginTop: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            borderRadius: "10px",
            padding: "9px 12px",
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            {minted}
          </span>
          <CopyButton text={minted} />
        </div>
      )}
    </form>
  );
}
