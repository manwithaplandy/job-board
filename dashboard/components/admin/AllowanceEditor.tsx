"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInviteAllowanceAction } from "@/app/actions/adminSettings";

// Per-tenant invites-left editor (isAdmin-gated /admin/tenants; the action re-gates).
// remaining=null means "no allowance row yet" — the tenant would see the default.
export function AllowanceEditor({
  userId,
  remaining,
  defaultAllowance,
}: {
  userId: string;
  remaining: number | null;
  defaultAllowance: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(remaining ?? defaultAllowance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await setInviteAllowanceAction({ userId, remaining: Number(value) });
      if (!res.ok) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <input
        type="number"
        min={0}
        max={1000}
        value={value}
        aria-label="Invites left"
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: "58px", fontSize: "12px", fontFamily: "inherit", color: "var(--text-primary)",
          background: "var(--bg-muted)", border: error ? "1px solid var(--danger)" : "1px solid var(--border)",
          borderRadius: "7px", padding: "3px 6px",
        }}
      />
      {remaining === null && (
        <span title="No allowance row yet — this tenant sees the default" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          default
        </span>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        style={{
          border: "1px solid var(--border)", borderRadius: "7px", background: "var(--bg-surface)",
          color: "var(--text-secondary)", fontSize: "11px", fontWeight: 700, padding: "3px 8px",
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}
      >
        {busy ? "…" : "Set"}
      </button>
    </span>
  );
}
