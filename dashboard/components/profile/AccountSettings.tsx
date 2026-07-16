import { DangerZone } from "@/components/account/DangerZone";
import { AppearanceToggle } from "@/components/theme/AppearanceToggle";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Panel";

export function AccountSettings() {
  return (
    <div className="account-settings profile-page-stack">
      <Card as="section" padding="lg" className="account-settings__section" aria-labelledby="plan-billing-heading">
        <h2 id="plan-billing-heading">Plan &amp; billing</h2>
        <p className="settings-help-text">View your current plan, payment details, and billing history.</p>
        <ButtonLink variant="outline" size="sm" href="/billing">Manage plan and billing</ButtonLink>
      </Card>

      <Card as="section" padding="lg" id="appearance" className="account-settings__section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <p className="settings-help-text">
          Choose how Rolefit looks on this device. Your selection is stored only in this browser.
        </p>
        <AppearanceToggle />
      </Card>

      <Card as="section" padding="lg" className="account-settings__section" aria-labelledby="data-privacy-heading">
        <h2 id="data-privacy-heading">Data &amp; privacy</h2>
        <p className="settings-help-text">
          Download a copy of your data or permanently remove your Rolefit account.
        </p>
      </Card>

      <section role="region" aria-label="Danger zone">
        <DangerZone />
      </section>
    </div>
  );
}
