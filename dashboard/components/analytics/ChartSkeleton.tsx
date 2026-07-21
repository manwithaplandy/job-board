import { Card } from "@/components/ui/Panel";

// Loading placeholder for the recharts-backed Trends and Breakdowns sections, which
// are code-split via next/dynamic (ssr:false) so the ~110KB-gz recharts bundle stays
// off the analytics first paint. It reserves roughly the real grid's vertical footprint
// — a card head plus a 240px chart body, matching Chart.tsx's ResponsiveContainer
// height — so streaming the real charts in doesn't shift the page. Purely decorative
// (aria-hidden); tokens carry both light and dark themes.
const CHART_BODY_HEIGHT = 240; // mirrors the ResponsiveContainer height in Chart.tsx

export function ChartSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    // Single geometry-scope marker exempts the placeholder's inline block sizing from the
    // UI contract, the same way HBarCard scopes its data-driven bar geometry.
    <div aria-hidden="true" data-ui-contract-geometry-scope="chart loading placeholder geometry">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: "16px" }}>
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i} className="rf-analytics-card" padding="sm">
            <div className="rf-analytics-card__head">
              <div style={{ width: "48%", height: "13px", borderRadius: "5px", background: "var(--bg-muted)" }} />
              <div style={{ width: "72%", height: "10px", marginTop: "7px", borderRadius: "5px", background: "var(--bg-muted)" }} />
            </div>
            <div style={{ height: `${CHART_BODY_HEIGHT}px`, borderRadius: "8px", background: "var(--bg-muted)" }} />
          </Card>
        ))}
      </div>
    </div>
  );
}
