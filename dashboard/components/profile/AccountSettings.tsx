import Link from "next/link";
import { DangerZone } from "@/components/account/DangerZone";
import { AppearanceToggle } from "@/components/theme/AppearanceToggle";

const sectionStyle: React.CSSProperties = {
  padding: "22px 0",
  borderBottom: "1px solid var(--border)",
};

const headingStyle: React.CSSProperties = { margin: "0 0 7px", fontSize: "17px" };
const explanationStyle: React.CSSProperties = {
  margin: "0 0 16px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
};

export function AccountSettings() {
  return (
    <div>
      <section aria-labelledby="plan-billing-heading" style={sectionStyle}>
        <h2 id="plan-billing-heading" style={headingStyle}>Plan &amp; billing</h2>
        <p className="settings-help-text" style={explanationStyle}>View your current plan, payment details, and billing history.</p>
        <Link className="settings-card-action rf-focusable" href="/billing">
          Manage plan and billing
        </Link>
      </section>

      <section id="appearance" aria-labelledby="appearance-heading" style={sectionStyle}>
        <h2 id="appearance-heading" style={headingStyle}>Appearance</h2>
        <p className="settings-help-text" style={explanationStyle}>
          Choose how Rolefit looks on this device. Your selection is stored only in this browser.
        </p>
        <AppearanceToggle />
      </section>

      <section aria-labelledby="data-privacy-heading" style={sectionStyle}>
        <h2 id="data-privacy-heading" style={headingStyle}>Data &amp; privacy</h2>
        <p className="settings-help-text" style={explanationStyle}>
          Download a copy of your data or permanently remove your Rolefit account.
        </p>
      </section>

      <section role="region" aria-label="Danger zone">
        <DangerZone />
      </section>
    </div>
  );
}
