import { Button } from "./Button";
import { TextField } from "./FormControls";
import { PageHeader } from "./Navigation";
import { Badge, Card } from "./Panel";
import { Alert, EmptyState, ErrorState } from "./SystemStates";
import { Icon } from "./Icon";
import { VisualBoardState, type VisualBoardStateName } from "@/components/rolefit/VisualBoardState";
import { HBarCard } from "@/components/analytics/Chart";
import { AgentChat } from "@/components/agent/AgentChat";
import { MemoDiffFixture } from "@/components/workspaces/MemoDiffFixture";
import { ShortlistBoard } from "@/components/workspaces/ShortlistBoard";
import type { ShortlistRow } from "@/lib/workspaces/types";

const AGENT_FIXTURE_THREAD = "00000000-0000-4000-8000-000000000000";

const WS_NO_FILTERS = { verdict: null, minFit: null, remote: false } as const;
const WS_AGENT_SKIPPED: ShortlistRow = {
  jobId: "greenhouse:acme:1001",
  state: "skipped",
  reasonCode: "red_flag",
  reasonText: "The posting asks for an unpaid trial week.",
  briefWhy: "Strong match on product engineering and the remote setup you asked for.",
  briefRisk: "Unpaid trial week before an offer.",
  setBy: "agent",
  updatedAt: "2026-11-20T00:00:00.000Z",
  fitScore: 84,
  job: {
    jobId: "greenhouse:acme:1001",
    title: "Senior Product Engineer",
    company: "Acme Systems",
    location: "Remote",
    remote: true,
    url: "https://example.com/jobs/1001",
    firstSeenAt: "2026-11-18T00:00:00.000Z",
    ageDays: 2,
    closed: false,
  },
};

const COPY: Record<string, { eyebrow: string; title: string; description: string }> = {
  "board-selected": { eyebrow: "Board · selected", title: "Senior Product Engineer", description: "Acme Systems · Remote · Selected job detail" },
  "board-filter-empty": { eyebrow: "Board · filtered", title: "No jobs match these filters", description: "Clear one or more filters to return to your reviewed queue." },
  "board-rejected": { eyebrow: "Board · rejected", title: "Job moved to Rejected", description: "The board keeps the decision visible and reversible." },
  "board-applied": { eyebrow: "Board · applied", title: "Application tracked", description: "Applied today · View the prepared application package." },
  "board-loading": { eyebrow: "Board · loading", title: "Loading reviewed jobs", description: "The workspace preserves its structure while results arrive." },
  "board-error-retry": { eyebrow: "Board · error", title: "The board could not load", description: "A specific recovery action remains available." },
  "board-generation": { eyebrow: "Board · generation", title: "Tailoring your résumé", description: "Generating grounded material for Senior Product Engineer…" },
  "board-application-package": { eyebrow: "Board · application", title: "Application package ready", description: "Résumé, cover letter, and screening answers are ready to review." },
  "companies-empty": { eyebrow: "Companies · empty", title: "No companies found", description: "Try a broader name or switch the review bucket." },
  "analytics-data-viz": { eyebrow: "Analytics · data", title: "Review throughput", description: "Seven-day reviewed and approved job volume." },
  "billing-current": { eyebrow: "Billing · current", title: "Standard plan", description: "Your current plan and next billing action." },
  "profile-error": { eyebrow: "Profile · error", title: "Application details", description: "Correct the highlighted field before saving." },
  "profile-disabled": { eyebrow: "Profile · disabled", title: "Advanced AI settings", description: "Higher reasoning levels are available on Pro." },
  "profile-destructive": { eyebrow: "Profile · destructive", title: "Delete account", description: "This action permanently removes account data after confirmation." },
  "admin-empty": { eyebrow: "Admin · empty", title: "No invite codes yet", description: "Generate an invite when a new teammate is ready." },
  "agent-empty": { eyebrow: "Agent · empty", title: "New conversation", description: "Ask about your reviewed jobs, companies and profile." },
  "agent-budget": { eyebrow: "Agent · budget", title: "Daily budget reached", description: "The composer stays disabled until the budget resets." },
  "agent-disabled": { eyebrow: "Agent · disabled", title: "Agent switched off", description: "The workspaces keep working while the agent is paused." },
  "workspaces-empty": { eyebrow: "Workspaces · empty", title: "Shortlist", description: "Nothing triaged yet; the agent and suggestions fill it." },
  "workspaces-agent-marker": { eyebrow: "Workspaces · agent", title: "Shortlist", description: "A row the agent skipped, with its reason and Undo." },
  "workspaces-memo-diff": { eyebrow: "Workspaces · memo", title: "What I'm looking for", description: "The agent's proposed memo change, waiting for Approve, Edit or Decline." },
  "system-states-focus": { eyebrow: "System · focus", title: "Keyboard interaction", description: "Focus, selected, disabled, and pressed treatments." },
  "system-states-destructive": { eyebrow: "System · destructive", title: "Destructive confirmation", description: "Danger actions are visually and semantically distinct." },
};

export function VisualStateFixture({ state }: { state: string }) {
  const copy = COPY[state];
  if (!copy) return <ErrorState title="Unknown visual state" description={state} />;
  if (state.startsWith("board-")) {
    return <main className="rf-gallery rf-visual-state" data-visual-state={state}><PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} /><VisualBoardState state={state.slice("board-".length) as VisualBoardStateName} /></main>;
  }
  const content = (() => {
    // The production chat, with no messages and the page's notice for each state.
    if (state === "agent-empty") return <AgentChat threadId={AGENT_FIXTURE_THREAD} initialMessages={[]} notice={null} />;
    if (state === "agent-budget") return <AgentChat threadId={AGENT_FIXTURE_THREAD} initialMessages={[]} notice="daily_ceiling" />;
    if (state === "agent-disabled") return <AgentChat threadId={AGENT_FIXTURE_THREAD} initialMessages={[]} notice="agent_disabled" />;
    // The production shortlist board with fixed rows.
    if (state === "workspaces-empty") return <ShortlistBoard rows={[]} markers={{}} browse={[]} filters={WS_NO_FILTERS} browseError={false} />;
    if (state === "workspaces-agent-marker") return <ShortlistBoard rows={[WS_AGENT_SKIPPED]} markers={{ [WS_AGENT_SKIPPED.jobId]: 1 }} browse={[]} filters={WS_NO_FILTERS} browseError={false} skippedOpen />;
    // The production memo confirm card with a fixed proposal.
    if (state === "workspaces-memo-diff") return <MemoDiffFixture />;
    if (state === "companies-empty" || state === "admin-empty") return <EmptyState title={copy.title} description={copy.description} action={<Button variant="outline">Clear filters</Button>} />;
    if (state === "profile-error") return <><Alert tone="danger" title="1 field needs attention">Review the inline message below.</Alert><TextField id="fixture-email" label="Email" error="Enter a valid email address." defaultValue="invalid" /><Button>Save changes</Button></>;
    if (state === "profile-disabled") return <><TextField id="fixture-model" label="Reasoning level" value="High · Pro" disabled readOnly /><Button disabled>Save changes</Button></>;
    if (state === "profile-destructive" || state === "system-states-destructive") return <Alert tone="danger" title={copy.title} action={<Button variant="destructive">Delete permanently</Button>}>{copy.description}</Alert>;
    if (state === "analytics-data-viz") return <HBarCard title="Review throughput" subtitle="Seven-day reviewed and approved volume" data={[{ label: "Mon", count: 18 }, { label: "Tue", count: 29 }, { label: "Wed", count: 24 }, { label: "Thu", count: 34 }, { label: "Fri", count: 31 }]} />;
    if (state === "billing-current") return <><div className="rf-gallery__row"><Badge tone="success">Current plan</Badge><Badge>Renews monthly</Badge></div><Button variant="outline">Manage billing</Button></>;
    if (state === "system-states-focus") return <div className="rf-gallery__row"><Button className="rf-visual-force-focus">Focused</Button><Button variant="outline" aria-pressed="true">Selected</Button><Button disabled>Disabled</Button></div>;
    return <><div className="rf-gallery__row"><Badge tone="success">Ready</Badge><Badge tone="accent">92% fit</Badge></div><Card padding="lg"><h2>{copy.title}</h2><p>{copy.description}</p><div className="rf-gallery__row"><Button><Icon name="sparkle" size={18} />Primary action</Button><Button variant="outline">Secondary action</Button></div></Card></>;
  })();
  return <main className="rf-gallery rf-visual-state" data-visual-state={state}><PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} /><Card className="rf-visual-state__surface" padding="lg">{content}</Card></main>;
}
