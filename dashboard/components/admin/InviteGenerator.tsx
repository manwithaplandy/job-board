"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInviteAction } from "@/app/actions/invites";
import { CopyButton } from "./CopyButton";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";

// Admin invite-minting form (rendered inside the isAdmin-gated /admin/invites page;
// the server action re-gates independently). On success it shows the minted code
// with a copy affordance and router.refresh()es so the server-rendered list below
// picks up the new row.

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
      <div className="rf-admin-form-grid">
          <TextField
            id="invite-note"
            label="Note"
            type="text"
            value={note}
            maxLength={200}
            placeholder="Who is this for?"
            onChange={(e) => setNote(e.target.value)}
          />
          <TextField
            id="invite-max-uses"
            label="Max uses"
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
          <TextField
            id="invite-expires"
            label="Expires"
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        <Button
          type="submit"
          loading={busy}
          loadingLabel="Generating invite"
        >
          {busy ? "Generating…" : "Generate invite"}
        </Button>
      </div>

      {showCustom ? (
        <div className="rf-admin-form-custom">
          <TextField
            id="invite-custom-code"
            label="Custom code"
            type="text"
            value={customCode}
            placeholder="e.g. TEAM-2026"
            onChange={(e) => setCustomCode(e.target.value)}
          />
        </div>
      ) : (
        <Button
          variant="text-link"
          onClick={() => setShowCustom(true)}
        >
          Use a custom code
        </Button>
      )}

      {error && (
        <div className="rf-action-error" role="alert">{error}</div>
      )}

      {minted && (
        <div className="rf-admin-minted">
          <span className="rf-admin-code">
            {minted}
          </span>
          <CopyButton text={minted} />
        </div>
      )}
    </form>
  );
}
