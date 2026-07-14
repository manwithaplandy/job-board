import type { Metadata } from "next";
import { SupportLink } from "@/components/SupportLink";
import { ReadingShell } from "@/components/ui/SystemStates";

// NOTE: Content-reviewed against the codebase on 2026-07-05 (processors, export,
// deletion-cascade, and billing claims verified in code) and shipped on the operator's
// decision for the invite-only beta. It has NOT been reviewed by a lawyer, is not legal
// advice, and does not substitute for review by counsel before a broader public launch.
// It names the ACTUAL processors used by this codebase — keep it in sync if the stack
// changes.
export const metadata: Metadata = { title: "Privacy Policy · Rolefit" };

export default function PrivacyPage() {
  return (
    <ReadingShell title="Privacy Policy" meta="Last updated 2026-07-05">

        <p>
          This policy explains what personal information Rolefit collects, how we use it, and
          the third-party processors we rely on. Rolefit is operated by Andrew Malvani, who
          is the data controller for the personal information described here
          (&ldquo;we,&rdquo; &ldquo;us&rdquo;). Your résumé is personal information (PII), so
          we treat it with care and keep the list of processors below deliberately explicit.
        </p>

        <h2>What we collect</h2>
        <p>
          Account data (email, authentication credentials managed by our auth provider),
          your profile (résumé text, instructions, location preferences, contact details, and
          any voluntary EEO self-identification you choose to provide), the job reviews and
          application packages we generate for you, and usage counters used to enforce plan
          limits. Payment is handled by Stripe — we never see or store your card number.
        </p>

        <h2>How we use it</h2>
        <p>
          We use your profile to review public job postings for fit and to generate tailored
          résumés and cover letters. To do this, your résumé text and instructions are sent to
          large-language-model providers for review and generation. We also record LLM traces
          (for debugging and quality) that may include your résumé text.
        </p>

        <h2>Third-party processors</h2>
        <p>We share data with the following processors, each only as needed to run the Service:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — our database, authentication, and file storage. Your
            profile, reviews, and uploaded résumé files are stored here at rest.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the web application (the dashboard you use).
          </li>
          <li>
            <strong>Railway</strong> — hosts our backend jobs (the reviewer and pollers).
          </li>
          <li>
            <strong>Stripe</strong> — processes subscription payments. Card data goes directly
            to Stripe and never touches our systems; we store only Stripe identifiers (a
            customer and subscription id) and your plan, status, and billing-period dates.
          </li>
          <li>
            <strong>OpenRouter</strong> and the downstream AI model providers it routes to —
            we send your résumé text and instructions to these providers to review jobs and
            generate résumés and cover letters.
          </li>
          <li>
            <strong>LangFuse</strong> (US cloud) — LLM observability. Traces we send for
            debugging and quality evaluation may include your résumé text. Traces are retained
            according to LangFuse&rsquo;s retention settings.
          </li>
        </ul>

        <h2>Storage &amp; retention</h2>
        <p>
          Your data is retained for as long as your account is active. Uploaded résumé files
          live in a storage bucket that is <strong>not versioned</strong> — when a file is
          deleted, it is gone permanently and cannot be recovered. We keep usage counters and
          minimal billing records as long as needed for accounting and abuse prevention.
        </p>

        <h2>Your rights: export &amp; deletion</h2>
        <p>
          You can download everything we hold about you at any time using{" "}
          <strong>Export my data</strong> on your{" "}
          <a href="/profile">profile page</a>. You can also permanently{" "}
          <strong>delete your account</strong> from the same page: deletion removes your
          profile, reviews, generated application packages, and archived résumé files from our
          storage, cancels any active subscription, and deletes your customer record (email,
          name, saved payment methods) from Stripe. Deletion is irreversible. We keep two
          minimal traces: a deletion-ledger entry holding a keyed, irreversible hash of your
          email (proof of erasure and abuse prevention — never the address itself), and
          internal pipeline run records permanently disassociated from your identity. Note
          that Stripe retains its own charge and invoice records for tax and accounting
          compliance, and that LLM traces already sent to LangFuse and data at third-party
          model providers are governed by those providers&rsquo; retention policies.
        </p>

        <h2>Security</h2>
        <p>
          Access to your data is enforced per-tenant at the database level, so one user&rsquo;s
          data is not visible to another. We restrict internal access and avoid exposing
          internal error details to clients.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or a data request?{" "}
          <SupportLink label="Contact support" subject="Privacy request" /> or review our{" "}
          <a href="/terms">Terms of Service</a>.
        </p>
    </ReadingShell>
  );
}
