"use client";

import type { FunnelCounts } from "@/lib/metrics";
import { GLOSSARY } from "@/lib/analyticsLabels";
import { InfoTip } from "@/components/analytics/InfoTip";

type Tone = "stage" | "good" | "bad" | "amber" | "muted";
const TONE_COLOR: Record<Tone, string> = {
  stage: "var(--chart-stage)", good: "var(--chart-good)", bad: "var(--chart-bad)", amber: "var(--chart-amber)", muted: "var(--chart-muted)",
};

interface RowSpec {
  label: string;
  value: number;
  tone?: Tone;
  /** base for the "% of X" caption, and (when scaleTo is omitted) the bar length */
  pctBase?: number;
  pctSuffix?: string;
  /** overrides the bar-length denominator when it differs from pctBase */
  scaleTo?: number;
  info?: { term: string; gloss: string };
}

function fmtPct(value: number, base: number): string {
  if (base <= 0) return "";
  const p = (value / base) * 100;
  const s = p < 10 ? p.toFixed(1) : String(Math.round(p));
  return `${s}%`;
}

function Row({ spec, barMax }: { spec: RowSpec; barMax: number }) {
  const tone = spec.tone ?? "stage";
  const frac = barMax > 0 ? spec.value / barMax : 0;
  const caption =
    spec.pctBase != null && spec.pctSuffix
      ? `${fmtPct(spec.value, spec.pctBase)} ${spec.pctSuffix}`
      : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ width: "148px", flex: "0 0 auto", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>
        {spec.info ? (
          <InfoTip term={spec.info.term} gloss={spec.info.gloss} labelStyle={{ color: "var(--text-secondary)" }}>
            {spec.label}
          </InfoTip>
        ) : (
          spec.label
        )}
      </div>
      <div style={{ flex: 1, minWidth: "40px", height: "20px", background: "var(--bg-muted)", borderRadius: "6px", overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.min(100, Math.round(frac * 100))}%`,
            height: "100%",
            background: TONE_COLOR[tone],
            borderRadius: "6px",
            minWidth: spec.value > 0 ? "3px" : 0,
          }}
        />
      </div>
      <div style={{ width: "62px", textAlign: "right", fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
        {spec.value.toLocaleString()}
      </div>
      <div style={{ width: "74px", textAlign: "right", fontSize: "11px", color: "var(--text-secondary)" }}>{caption}</div>
    </div>
  );
}

function SubHead({ children, info }: { children: React.ReactNode; info?: { term: string; gloss: string } }) {
  const style: React.CSSProperties = { fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", letterSpacing: ".4px", margin: "16px 0 8px", textTransform: "uppercase" };
  return (
    <div style={style}>
      {info ? (
        <InfoTip term={info.term} gloss={info.gloss} labelStyle={{ color: "var(--text-muted)" }}>{children}</InfoTip>
      ) : (
        children
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 380px", minWidth: 0 }}>
      <div style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "10px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>{children}</div>
    </div>
  );
}

export function FunnelSection({ funnel }: { funnel: FunnelCounts }) {
  const { companies: c, jobs: j } = funnel;

  // ── Companies: sequential stages scaled to Tracked ─────────────────────────
  const companyStageMax = Math.max(1, c.tracked);
  const companyStages: RowSpec[] = [
    { label: "Tracked", value: c.tracked, tone: "stage" },
    { label: "Found by discovery", value: c.discovery_sourced, tone: "stage", pctBase: c.tracked, pctSuffix: "of tracked",
      info: { term: GLOSSARY["discovery-sourced"].label, gloss: GLOSSARY["discovery-sourced"].gloss } },
    { label: "Classified", value: c.reviewed, tone: "stage", pctBase: c.discovery_sourced, pctSuffix: "of found" },
  ];
  const companyVerdicts: RowSpec[] = [
    { label: "Included", value: c.include, tone: "good", pctBase: c.reviewed, pctSuffix: "of classified",
      info: { term: GLOSSARY.included.label, gloss: GLOSSARY.included.gloss } },
    { label: "Excluded", value: c.exclude, tone: "bad", pctBase: c.reviewed, pctSuffix: "of classified",
      info: { term: GLOSSARY.excluded.label, gloss: GLOSSARY.excluded.gloss } },
    { label: "Unknown", value: c.unknown, tone: "muted", pctBase: c.reviewed, pctSuffix: "of classified",
      info: { term: GLOSSARY.unknown.label, gloss: GLOSSARY.unknown.gloss } },
  ];
  const companyVerdictMax = Math.max(1, c.include, c.exclude, c.unknown);

  // ── Jobs: sequential stages scaled to Ever seen ────────────────────────────
  const jobStageMax = Math.max(1, j.ever_seen);
  const jobStages: RowSpec[] = [
    { label: "Jobs ever seen", value: j.ever_seen, tone: "stage" },
    { label: "Open now", value: j.open, tone: "stage", pctBase: j.ever_seen, pctSuffix: "of ever seen" },
    { label: "Reviewed", value: j.reviewed, tone: "stage", pctBase: j.open, pctSuffix: "of open" },
  ];
  const jobOutcomes: RowSpec[] = [
    { label: "Gate-rejected", value: j.gate_rejected, tone: "amber", pctBase: j.reviewed, pctSuffix: "of reviewed",
      info: { term: GLOSSARY["gate-rejected"].label, gloss: GLOSSARY["gate-rejected"].gloss } },
    { label: "Approved", value: j.approved, tone: "good", pctBase: j.reviewed, pctSuffix: "of reviewed",
      info: { term: GLOSSARY.approved.label, gloss: GLOSSARY.approved.gloss } },
    { label: "Denied", value: j.denied, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
      info: { term: GLOSSARY.denied.label, gloss: GLOSSARY.denied.gloss } },
    { label: "Manually rejected", value: j.manual_rejected, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
      info: { term: GLOSSARY["manual-reject"].label, gloss: GLOSSARY["manual-reject"].gloss } },
    { label: "Errors", value: j.errors, tone: "bad", pctBase: j.reviewed, pctSuffix: "of reviewed",
      info: { term: GLOSSARY.errors.label, gloss: GLOSSARY.errors.gloss } },
  ];
  const jobOutcomeMax = Math.max(1, j.gate_rejected, j.approved, j.denied, j.manual_rejected, j.errors);

  return (
    <div>
      <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: "-6px 0 12px" }}>
        Current snapshot — job rows count open jobs only; bars within a group share a scale, and the % text is the honest figure.
      </div>
      <div
        style={{
          display: "flex", gap: "32px", flexWrap: "wrap",
          background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px",
        }}
      >
        <Panel title="Companies — Company Discovery">
          <SubHead>Pipeline stages</SubHead>
          {companyStages.map((s) => <Row key={s.label} spec={s} barMax={companyStageMax} />)}
          <SubHead info={{ term: GLOSSARY["company-verdicts"].label, gloss: GLOSSARY["company-verdicts"].gloss }}>
            Verdicts (share of classified)
          </SubHead>
          {companyVerdicts.map((s) => <Row key={s.label} spec={s} barMax={companyVerdictMax} />)}
          <SubHead>Queue</SubHead>
          <Row
            spec={{
              label: "Awaiting classification", value: c.backlog, tone: "muted",
              info: { term: GLOSSARY["backlog-state"].label, gloss: GLOSSARY["backlog-state"].gloss },
            }}
            barMax={companyStageMax}
          />
        </Panel>

        <Panel title="Jobs — Job Discovery → reviewer">
          <SubHead>Pipeline stages</SubHead>
          {jobStages.map((s) => <Row key={s.label} spec={s} barMax={jobStageMax} />)}
          <SubHead>Outcomes of review (share of reviewed)</SubHead>
          {jobOutcomes.map((s) => <Row key={s.label} spec={s} barMax={jobOutcomeMax} />)}
          <Row
            spec={{
              label: "Applied", value: j.applied, tone: "good",
              pctBase: j.approved, pctSuffix: "of approved",
              info: { term: GLOSSARY.applied.label, gloss: GLOSSARY.applied.gloss },
            }}
            barMax={Math.max(1, j.approved)}
          />
          <SubHead>Queue</SubHead>
          <Row
            spec={{
              label: "Not yet reviewed", value: j.unreviewed, tone: "muted",
              pctBase: j.open, pctSuffix: "of open",
              info: { term: GLOSSARY.unreviewed.label, gloss: GLOSSARY.unreviewed.gloss },
            }}
            barMax={Math.max(1, j.open)}
          />
        </Panel>
      </div>
    </div>
  );
}
