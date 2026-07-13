import type { ReactNode } from "react";

export function AppShell({ header, children, className }: { header: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div data-testid="app-shell" className={["app-shell", className].filter(Boolean).join(" ")}>
      {header}
      <div className="app-shell__content">{children}</div>
    </div>
  );
}
