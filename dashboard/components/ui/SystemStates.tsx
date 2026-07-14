import type { ReactNode } from "react";
import { Card } from "./Panel";
import { PageHeader } from "./Navigation";

type AlertTone = "info" | "success" | "warning" | "danger";

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const role = tone === "danger" ? "alert" : "status";
  return (
    <div className={["rf-alert", `rf-alert--${tone}`, className].filter(Boolean).join(" ")} role={role}>
      <div className="rf-alert__copy">
        {title && <h2 className="rf-alert__title">{title}</h2>}
        <div className="rf-alert__description">{children}</div>
      </div>
      {action && <div className="rf-alert__action">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["rf-empty-state", className].filter(Boolean).join(" ")}>
      <h2 className="rf-empty-state__title">{title}</h2>
      {description && <div className="rf-empty-state__description">{description}</div>}
      {action && <div className="rf-empty-state__action">{action}</div>}
    </div>
  );
}

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={["rf-loading-state", className].filter(Boolean).join(" ")}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <span className="rf-loading-state__indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
  reference,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  reference?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["rf-error-state", className].filter(Boolean).join(" ")} role="alert">
      <h2 className="rf-error-state__title">{title}</h2>
      <div className="rf-error-state__description">{description}</div>
      {action && <div className="rf-error-state__action">{action}</div>}
      {reference && <div className="rf-error-state__reference">{reference}</div>}
    </div>
  );
}

export function EntryShell({
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="rf-entry-shell">
      <Card className={["rf-entry-card", wide && "rf-entry-card--wide"].filter(Boolean).join(" ")} padding="lg">
        <PageHeader className="rf-entry-header" eyebrow="Rolefit" title={title} description={description} />
        <div className="rf-entry-body">{children}</div>
        {footer && <footer className="rf-entry-footer">{footer}</footer>}
      </Card>
    </main>
  );
}

export function ReadingShell({
  title,
  meta,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="rf-reading-shell">
      <Card className="rf-reading-card" padding="lg">
        <PageHeader className="rf-reading-header" eyebrow="Rolefit" title={title} description={meta} />
        <article className="rf-reading-content">{children}</article>
      </Card>
    </main>
  );
}
