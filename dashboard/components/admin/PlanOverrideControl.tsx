"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPlanOverrideAction } from "@/app/actions/adminSettings";
import { Button } from "@/components/ui/Button";

// Per-tenant effective-tier pin (isAdmin-gated /admin/tenants; the action re-gates).
// plan "" = no pin (natural subscription/invite resolution). Set with a plan upserts;
// Set on "No override" clears. Expiry/note only apply alongside a plan, so they are
// hidden (and submitted empty) when clearing. Compact inline editor like
// AllowanceEditor; geometry lives in .rf-override-editor (secondary-surfaces.css).
export function PlanOverrideControl({
  userId,
  plan,
  expiresAt,
  note,
}: {
  userId: string;
  plan: "" | "standard" | "pro";
  expiresAt: string; // YYYY-MM-DD or ""
  note: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(plan);
  const [expiry, setExpiry] = useState(expiresAt);
  const [memo, setMemo] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await setPlanOverrideAction({
        userId,
        plan: value,
        expiresAt: value === "" ? "" : expiry,
        note: value === "" ? "" : memo,
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't save the override. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="rf-override-editor">
      <select
        value={value}
        aria-label="Plan override"
        onChange={(e) => setValue(e.target.value)}
        className="rf-control rf-focusable rf-override-editor__select"
      >
        <option value="">No override</option>
        <option value="standard">Standard</option>
        <option value="pro">Pro</option>
      </select>
      {value !== "" && (
        <>
          <input
            type="date"
            value={expiry}
            aria-label="Override expiry (optional)"
            onChange={(e) => setExpiry(e.target.value)}
            className="rf-control rf-focusable rf-override-editor__date"
          />
          <input
            type="text"
            value={memo}
            maxLength={200}
            placeholder="note"
            aria-label="Override note (optional)"
            onChange={(e) => setMemo(e.target.value)}
            className="rf-control rf-focusable rf-override-editor__note"
          />
        </>
      )}
      <Button size="sm" onClick={save} loading={busy} loadingLabel="Saving override">
        Set
      </Button>
      {error && (
        <span role="alert" className="rf-override-editor__error">
          {error}
        </span>
      )}
    </span>
  );
}
