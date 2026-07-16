import Link from "next/link";
import { PageHeader } from "@/components/ui/Navigation";
import type { ProfileReadiness } from "@/lib/profileReadiness";
import { SettingsSectionCard } from "./SettingsSectionCard";

interface ProfileHubProps {
  readiness: ProfileReadiness;
}

export function ProfileHub({ readiness }: ProfileHubProps) {
  return (
    <main className="profile-hub profile-page-stack">
      <PageHeader
        title="Profile"
        description="Your profile controls job matching and prepares reusable application information."
      />
      <div className="profile-readiness" role="status" aria-label="Profile readiness">
        <p className="profile-readiness-overall">{readiness.overall}</p>
        <p>{readiness.readyCount} of {readiness.totalCore} core sections ready</p>
      </div>

      <div className="settings-card-grid">
        <SettingsSectionCard
          title="Job Preferences"
          status={readiness.jobPreferences.status}
          summary={readiness.jobPreferences.summary}
          explanation="Rolefit uses these preferences to find and prioritize matching jobs."
          href="/profile/job-preferences"
          actionLabel="Review preferences"
          priority="primary"
        />
        <SettingsSectionCard
          title="Résumé & Experience"
          status={readiness.resume.status}
          summary={readiness.resume.summary}
          explanation="Your résumé supports job matching and tailored application materials."
          href="/profile/resume"
          actionLabel="Review résumé"
          priority="primary"
        />
        <SettingsSectionCard
          title="Application Details"
          status={readiness.applicationDetails.status}
          summary={readiness.applicationDetails.summary}
          explanation="Saved details make application preparation faster and more consistent."
          href="/profile/application-details"
          actionLabel="Review details"
          priority="primary"
        />
        <SettingsSectionCard
          title="Application Personalization"
          status={readiness.personalization.status}
          summary={readiness.personalization.summary}
          explanation="Writing preferences guide generated résumés and cover letters."
          href="/profile/application-personalization"
          actionLabel="Review personalization"
          priority="primary"
        />
      </div>

      <nav className="settings-nav" aria-label="Secondary settings">
        <Link className="settings-nav-link" href="/profile/account#appearance">Appearance</Link>
        <Link className="settings-nav-link" href="/billing">Plan &amp; billing</Link>
        <Link className="settings-nav-link" href="/profile/advanced">Advanced AI settings</Link>
        <Link className="settings-nav-link" href="/profile/account">Account</Link>
      </nav>
    </main>
  );
}
