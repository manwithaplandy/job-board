"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteMyAccount, type DeleteAccountState } from "@/app/actions/account";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";
import { Card } from "@/components/ui/Panel";

// Export stays ahead of deletion so a user can recover their data before erasing it.
// The confirmation is a UX guard; the server action remains the security boundary.
function DeleteAccountButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" loading={pending} loadingLabel="Deleting account">
      {pending ? "Deleting…" : "Delete account"}
    </Button>
  );
}

export function DangerZone() {
  const [state, action] = useActionState<DeleteAccountState, FormData>(deleteMyAccount, null);
  return (
    <Card className="danger-zone" padding="lg">
      <div className="danger-zone__label">Danger zone</div>

      <div className="danger-zone__section">
        <div className="danger-zone__row-title">Export my data</div>
        <p className="danger-zone__help">
          Download everything we hold about you (profile, reviews, generated packages, and
          links to your uploaded résumé files) as a JSON file.
        </p>
        <ButtonLink href="/api/account/export" variant="outline" size="sm">Export my data</ButtonLink>
      </div>

      <div className="danger-zone__section danger-zone__section--destructive">
        <div className="danger-zone__row-title">Delete my account</div>
        <p className="danger-zone__help">
          Permanently deletes your profile, reviews, generated application packages, and
          archived résumé files, and cancels any active subscription. This cannot be undone.
          Type <strong>DELETE</strong> to confirm.
        </p>
        <form action={action} className="danger-zone__form">
          <TextField
            name="confirm"
            label="Confirmation"
            placeholder="DELETE"
            autoComplete="off"
            aria-label="Type DELETE to confirm account deletion"
            error={state?.error}
            className="danger-zone__input"
          />
          <DeleteAccountButton />
        </form>
      </div>
    </Card>
  );
}
