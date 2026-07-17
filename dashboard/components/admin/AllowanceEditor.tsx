"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInviteAllowanceAction } from "@/app/actions/adminSettings";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";

// Per-tenant invites-left editor (isAdmin-gated /admin/tenants; the action re-gates).
// remaining=null means "no allowance row yet" — the tenant would see the default.
// Compact inline editor: the number field and Set button are shared primitives that
// keep 44px targets even inside the admin compact-density table; geometry lives in the
// .rf-allowance-editor classes (secondary-surfaces.css).
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
    <span className="rf-allowance-editor">
      <input
        type="number"
        min={0}
        max={1000}
        value={value}
        aria-label="Invites left"
        aria-invalid={error || undefined}
        onChange={(e) => setValue(e.target.value)}
        className="rf-control rf-focusable rf-allowance-editor__input"
      />
      {remaining === null && (
        <Badge tone="neutral" title="No allowance row yet — this tenant sees the default">
          default
        </Badge>
      )}
      <Button size="sm" onClick={save} loading={busy} loadingLabel="Saving invites left">
        Set
      </Button>
    </span>
  );
}
