import { Alert } from "@/components/ui/SystemStates";
import { Button, ButtonLink } from "@/components/ui/Button";

export type AgentNoticeKind = "no_plan" | "agent_disabled" | "daily_ceiling" | "monthly_ceiling" | "interrupted";

/** The notices that stop the composer (everything but an interrupted reply). */
export type AgentBlockingNotice = Exclude<AgentNoticeKind, "interrupted">;

const COPY: Record<AgentNoticeKind, { tone: "info" | "warning"; title: string; body: string }> = {
  no_plan: {
    tone: "info",
    title: "The agent is part of a paid plan",
    body: "Subscribe to ask the agent about your reviewed jobs. Your board, companies and profile keep working as usual.",
  },
  agent_disabled: {
    tone: "info",
    title: "The agent is switched off",
    body: "The agent is paused for now. Your board, companies and profile keep working as usual.",
  },
  daily_ceiling: {
    tone: "warning",
    title: "Today's agent budget is used up",
    body: "The agent is available again after midnight UTC. Your board, companies and profile keep working as usual.",
  },
  monthly_ceiling: {
    tone: "warning",
    title: "This month's agent budget is used up",
    body: "The agent is available again on the first of next month (UTC). Your board, companies and profile keep working as usual.",
  },
  interrupted: {
    tone: "warning",
    title: "This reply was interrupted",
    body: "The last reply did not finish. Retry it, or carry on in your workspaces.",
  },
};

/** A notice's title, for the expanded view's status line (spec 08 S6.2), where the notice itself is out of sight. */
export function agentNoticeTitle(kind: AgentNoticeKind): string {
  return COPY[kind].title;
}

// Every notice links to the workspaces, which work with the agent off (spec: the agent
// is never the only way to do a thing).
const WORKSPACES = [
  { href: "/", label: "Board" },
  { href: "/companies", label: "Companies" },
  { href: "/profile", label: "Profile" },
] as const;

export function AgentNotice({ kind, onRetry }: { kind: AgentNoticeKind; onRetry?: () => void }) {
  const copy = COPY[kind];
  return (
    <Alert tone={copy.tone} title={copy.title} className="rf-agent-notice">
      <p>{copy.body}</p>
      <div className="rf-agent-notice__actions">
        {kind === "interrupted" && onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
        {kind === "no_plan" && <ButtonLink href="/billing" size="sm">See plans</ButtonLink>}
        {WORKSPACES.map((w) => (
          <ButtonLink key={w.href} href={w.href} size="sm" variant="outline">{w.label}</ButtonLink>
        ))}
      </div>
    </Alert>
  );
}
