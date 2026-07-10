import Link from "next/link";

interface SettingsSectionCardProps {
  title: string;
  status: string;
  summary: string;
  explanation: string;
  href: string;
  actionLabel: string;
  priority?: "primary" | "normal";
}

export function SettingsSectionCard({ title, status, summary, explanation, href, actionLabel, priority = "normal" }: SettingsSectionCardProps) {
  return (
    <article className={`settings-card settings-card-${priority}`}>
      <div className="settings-card-heading">
        <h2>{title}</h2>
        <span className="settings-card-status">{status}</span>
      </div>
      <p className="settings-card-summary">{summary}</p>
      <p className="settings-card-explanation">{explanation}</p>
      <Link className="settings-card-action" href={href}>{actionLabel}</Link>
    </article>
  );
}
