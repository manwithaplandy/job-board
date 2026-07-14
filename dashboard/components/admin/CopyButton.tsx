"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Tiny client leaf so server-rendered admin tables can offer per-row copy.
// Best-effort: clipboard can be unavailable (http, permissions) — failure is silent
// and the label simply doesn't flip.
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="compact"
      aria-label={`Copy ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — leave the label as "Copy" */
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={16} />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
