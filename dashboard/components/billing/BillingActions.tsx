"use client";

import { useState } from "react";
import type { Plan } from "@/lib/entitlements";
import { Button } from "@/components/ui/Button";

// Client buttons for the billing page: POST to the checkout/portal routes and follow
// the returned Stripe URL. Kept tiny — all pricing/copy lives in the server page.
async function go(url: string, body?: unknown): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error || "Something went wrong. Please try again.");
  return data.url;
}

export function SubscribeButton({ plan, current }: { plan: Plan; current: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      window.location.href = await go("/api/stripe/checkout", { plan });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant={current ? "secondary" : "primary"}
        onClick={onClick}
        disabled={busy || current}
        loading={busy}
        loadingLabel="Redirecting to checkout"
      >
        {current ? "Current plan" : busy ? "Redirecting…" : `Subscribe to ${plan === "pro" ? "Pro" : "Standard"}`}
      </Button>
      {error && <div className="rf-action-error" role="alert">{error}</div>}
    </>
  );
}

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      window.location.href = await go("/api/stripe/portal");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="outline"
        onClick={onClick}
        disabled={busy}
        loading={busy}
        loadingLabel="Redirecting to billing portal"
      >
        {busy ? "Redirecting…" : "Manage billing"}
      </Button>
      {error && <div className="rf-action-error" role="alert">{error}</div>}
    </>
  );
}
