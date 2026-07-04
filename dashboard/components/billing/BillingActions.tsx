"use client";

import { useState } from "react";
import type { Plan } from "@/lib/entitlements";

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

const btnStyle: React.CSSProperties = {
  marginTop: "16px",
  width: "100%",
  border: "none",
  borderRadius: "10px",
  padding: "11px 14px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

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
      <button
        type="button"
        onClick={onClick}
        disabled={busy || current}
        style={{
          ...btnStyle,
          background: current ? "#e7eaf0" : "#3b6fd4",
          color: current ? "#6b7480" : "#fff",
          cursor: current ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {current ? "Current plan" : busy ? "Redirecting…" : `Subscribe to ${plan === "pro" ? "Pro" : "Standard"}`}
      </button>
      {error && <div style={{ marginTop: "8px", fontSize: "12px", color: "#c0392b" }}>{error}</div>}
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
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{ ...btnStyle, marginTop: 0, background: "#f4f6fa", color: "#1f2430", border: "1px solid #e3e7ee" }}
      >
        {busy ? "Redirecting…" : "Manage billing"}
      </button>
      {error && <div style={{ marginTop: "8px", fontSize: "12px", color: "#c0392b" }}>{error}</div>}
    </>
  );
}
