import { Button } from "./Button";
import { TextField } from "./FormControls";
import { PageHeader } from "./Navigation";
import { Badge, Card } from "./Panel";
import { Alert, EmptyState, ErrorState, LoadingState } from "./SystemStates";
import { Icon } from "./Icon";

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
  "system-states-focus": { eyebrow: "System · focus", title: "Keyboard interaction", description: "Focus, selected, disabled, and pressed treatments." },
  "system-states-destructive": { eyebrow: "System · destructive", title: "Destructive confirmation", description: "Danger actions are visually and semantically distinct." },
};

export function VisualStateFixture({ state }: { state: string }) {
  const copy = COPY[state];
  if (!copy) return <ErrorState title="Unknown visual state" description={state} />;
  const content = (() => {
    if (state === "board-filter-empty" || state === "companies-empty" || state === "admin-empty") return <EmptyState title={copy.title} description={copy.description} action={<Button variant="outline">Clear filters</Button>} />;
    if (state === "board-loading" || state === "board-generation") return <LoadingState label={copy.description} />;
    if (state === "board-error-retry") return <ErrorState title={copy.title} description={copy.description} action={<Button>Retry</Button>} reference="Reference UI-409" />;
    if (state === "profile-error") return <><Alert tone="danger" title="1 field needs attention">Review the inline message below.</Alert><TextField id="fixture-email" label="Email" error="Enter a valid email address." defaultValue="invalid" /><Button>Save changes</Button></>;
    if (state === "profile-disabled") return <><TextField id="fixture-model" label="Reasoning level" value="High · Pro" disabled readOnly /><Button disabled>Save changes</Button></>;
    if (state === "profile-destructive" || state === "system-states-destructive") return <Alert tone="danger" title={copy.title} action={<Button variant="destructive">Delete permanently</Button>}>{copy.description}</Alert>;
    if (state === "analytics-data-viz") return <div className="rf-visual-bars" data-ui-visual="data-viz" aria-label="Review throughput bar chart" role="img"><span /><span /><span /><span /><span /></div>;
    if (state === "billing-current") return <><div className="rf-gallery__row"><Badge tone="success">Current plan</Badge><Badge>Renews monthly</Badge></div><Button variant="outline">Manage billing</Button></>;
    if (state === "system-states-focus") return <div className="rf-gallery__row"><Button className="rf-visual-force-focus">Focused</Button><Button variant="outline" aria-pressed="true">Selected</Button><Button disabled>Disabled</Button></div>;
    return <><div className="rf-gallery__row"><Badge tone={state === "board-rejected" ? "danger" : "success"}>{state === "board-rejected" ? "Rejected" : state === "board-applied" ? "Applied" : "Ready"}</Badge><Badge tone="accent">92% fit</Badge></div><Card padding="lg"><h2>{copy.title}</h2><p>{copy.description}</p><div className="rf-gallery__row"><Button><Icon name="sparkle" size={18} />{state === "board-application-package" ? "Review package" : "Primary action"}</Button><Button variant="outline">Secondary action</Button></div></Card></>;
  })();
  return <main className="rf-gallery rf-visual-state" data-visual-state={state}><PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} /><Card className="rf-visual-state__surface" padding="lg">{content}</Card></main>;
}
