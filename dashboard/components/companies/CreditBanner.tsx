"use client";

import { useTransition } from "react";
import type { DiscoveryStateRow } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function CreditBanner({
  state, refresh, canRefresh,
}: { state: DiscoveryStateRow; refresh: () => Promise<void>; canRefresh: boolean }) {
  const [pending, start] = useTransition();
  if (!state.halted_no_credits) return null;
  return (
    <div className="rf-credit-banner" role="status">
      <Icon name="warning" size={18} />
      <span>Company scan paused — OpenRouter out of credits.
        {state.backlog > 0 ? ` ${state.backlog.toLocaleString()} companies still pending.` : ""}
      </span>
      {/* Only admins may unhalt the SHARED discovery pipeline (the server action gates
          this too); non-admins just see the informational paused notice. */}
      {canRefresh && (
        <Button
          variant="primary"
          onClick={() => start(async () => { await refresh(); })}
          disabled={pending}
          size="sm"
        >
          {pending ? "Refreshing…" : "Refresh"}
        </Button>
      )}
    </div>
  );
}
