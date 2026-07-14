import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Panel";

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
  const tone = status === "Ready" ? "success" : status === "Optional" ? "neutral" : "warning";
  return (
    <Card as="article" padding="lg" className={`settings-card settings-card-${priority}`}>
      <div className="settings-card-heading">
        <h2>{title}</h2>
        <Badge tone={tone} className="settings-card-status">{status}</Badge>
      </div>
      <p className="settings-card-summary">{summary}</p>
      <p className="settings-card-explanation">{explanation}</p>
      <ButtonLink variant="text-link" size="compact" className="settings-card-action" href={href}>{actionLabel}</ButtonLink>
    </Card>
  );
}
