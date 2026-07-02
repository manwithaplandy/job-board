import type { JobRow } from "@/lib/types";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import { facetCounts } from "@/lib/rolefit/filter";

// Static filter definitions — mirrored from reference design renderVals()
const PAY_DEFS: [number, string][] = [
  [0, "Any pay"],
  [120, "$120k+"],
  [150, "$150k+"],
  [180, "$180k+"],
  [220, "$220k+"],
];

const MATCH_DEFS: [number, string][] = [
  [0, "Any match"],
  [60, "60%+"],
  [75, "75%+"],
  [90, "90%+"],
];

const SORT_DEFS: [BoardFilterState["sort"], string][] = [
  ["match", "Best match"],
  ["pay", "Highest pay"],
  ["newest", "Newest"],
  ["az", "Company A–Z"],
];

const REMOTE_DEFS: [BoardFilterState["remote"], string][] = [
  ["all", "All"],
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "Onsite"],
];

// Human-readable labels for the six companies.ats identifiers. Unknown values fall
// back to the raw identifier so an unexpected provider never blanks or crashes.
const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  workday: "Workday",
};
const atsLabel = (ats: string) => ATS_LABELS[ats] ?? ats;

export interface FilterBarProps {
  jobs: JobRow[];
  cats: string[];
  locs: string[];
  sources: string[];
  remote: BoardFilterState["remote"];
  minFit: number;
  payMin: number;
  sort: BoardFilterState["sort"];
  openMenu: string | null;
  visibleCount: number;
  appliedView?: boolean;
  appliedCount?: number;
  onToggleApplied?: () => void;
  onToggleMenu: (name: string) => void;
  onToggleCat: (cat: string) => void;
  onToggleLoc: (loc: string) => void;
  onToggleSource: (ats: string) => void;
  onSetRemote: (r: BoardFilterState["remote"]) => void;
  onSetMinFit: (v: number) => void;
  onSetPayMin: (v: number) => void;
  onSetSort: (s: BoardFilterState["sort"]) => void;
}

export function FilterBar({
  jobs,
  cats,
  locs,
  sources,
  remote,
  minFit,
  payMin,
  sort,
  openMenu,
  visibleCount,
  appliedView,
  appliedCount,
  onToggleApplied,
  onToggleMenu,
  onToggleCat,
  onToggleLoc,
  onToggleSource,
  onSetRemote,
  onSetMinFit,
  onSetPayMin,
  onSetSort,
}: FilterBarProps) {
  const { categories, locations, sources: sourceCounts } = facetCounts(jobs);

  const activeBtn = (on: boolean) => ({
    bg: on ? "#eef3fc" : "#ffffff",
    border: on ? "#bcd0f2" : "#dfe3ea",
  });
  const cb = activeBtn(cats.length > 0);
  const lb = activeBtn(locs.length > 0);
  const sb = activeBtn(sources.length > 0);
  const pb = activeBtn(payMin > 0);
  const mb = activeBtn(minFit > 0);

  const catBadge = cats.length ? ` · ${cats.length}` : "";
  const locBadge = locs.length ? ` · ${locs.length}` : "";
  const srcBadge = sources.length ? ` · ${sources.length}` : "";
  const payBadge = payMin > 0 ? ` · ${PAY_DEFS.find(([v]) => v === payMin)?.[1] ?? ""}` : "";
  const matchBadge = minFit > 0 ? ` · ${MATCH_DEFS.find(([v]) => v === minFit)?.[1] ?? ""}` : "";
  const sortLabel = SORT_DEFS.find(([v]) => v === sort)?.[1] ?? "Best match";

  const box = (on: boolean) => ({
    boxBg: on ? "#3b6fd4" : "#ffffff",
    boxBorder: on ? "#3b6fd4" : "#cdd5e0",
    check: on ? "✓" : "",
  });
  const radio = (on: boolean) => ({
    bg: on ? "#eef3fc" : "transparent",
    weight: on ? 700 : 500,
    check: on ? "✓" : "",
  });

  const catItems = Object.entries(categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, count]) => ({ cat, count, ...box(cats.includes(cat)) }));

  const locItems = Object.entries(locations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([loc, count]) => ({ loc, count, ...box(locs.includes(loc)) }));

  const sourceItems = Object.entries(sourceCounts)
    .map(([ats, count]) => ({ ats, label: atsLabel(ats), count, ...box(sources.includes(ats)) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const dropdownBase = {
    position: "absolute" as const,
    top: "calc(100% + 7px)",
    zIndex: 50,
    background: "#fff",
    border: "1px solid #e3e7ee",
    borderRadius: "13px",
    boxShadow: "0 16px 40px rgba(20,28,45,.17)",
    padding: "7px",
  };

  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: "10px 22px",
        background: "#fff",
        borderBottom: "1px solid #e7eaf0",
        flexWrap: "wrap",
        zIndex: 15,
        position: "relative",
      }}
    >
      {/* Category */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("category")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: cb.bg,
            border: `1px solid ${cb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Category{catBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "category" && (
          <div
            style={{
              ...dropdownBase,
              left: 0,
              width: "248px",
              maxHeight: "320px",
              overflow: "auto",
            }}
          >
            {catItems.map(({ cat, count, boxBg, boxBorder, check }) => (
              <div
                key={cat}
                onClick={() => onToggleCat(cat)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "5px",
                    border: `1.5px solid ${boxBorder}`,
                    background: boxBg,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {check}
                </span>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
                  {cat}
                </span>
                <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("pay")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: pb.bg,
            border: `1px solid ${pb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Pay{payBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "pay" && (
          <div style={{ ...dropdownBase, left: 0, width: "190px" }}>
            {PAY_DEFS.map(([v, label]) => {
              const r = radio(payMin === v);
              return (
                <div
                  key={v}
                  onClick={() => onSetPayMin(v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: r.bg,
                  }}
                >
                  <span
                    style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}
                  >
                    {label}
                  </span>
                  <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                    {r.check}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Match */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("match")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: mb.bg,
            border: `1px solid ${mb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Match{matchBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "match" && (
          <div style={{ ...dropdownBase, left: 0, width: "190px" }}>
            {MATCH_DEFS.map(([v, label]) => {
              const r = radio(minFit === v);
              return (
                <div
                  key={v}
                  onClick={() => onSetMinFit(v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: r.bg,
                  }}
                >
                  <span
                    style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}
                  >
                    {label}
                  </span>
                  <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                    {r.check}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Location */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("location")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: lb.bg,
            border: `1px solid ${lb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Location{locBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "location" && (
          <div
            style={{
              ...dropdownBase,
              left: 0,
              width: "230px",
              maxHeight: "320px",
              overflow: "auto",
            }}
          >
            {locItems.map(({ loc, count, boxBg, boxBorder, check }) => (
              <div
                key={loc}
                onClick={() => onToggleLoc(loc)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "5px",
                    border: `1.5px solid ${boxBorder}`,
                    background: boxBg,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {check}
                </span>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
                  {loc}
                </span>
                <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("source")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: sb.bg,
            border: `1px solid ${sb.border}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Source{srcBadge}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "source" && (
          <div
            style={{
              ...dropdownBase,
              left: 0,
              width: "230px",
              maxHeight: "320px",
              overflow: "auto",
            }}
          >
            {sourceItems.map(({ ats, label, count, boxBg, boxBorder, check }) => (
              <div
                key={ats}
                onClick={() => onToggleSource(ats)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "5px",
                    border: `1.5px solid ${boxBorder}`,
                    background: boxBg,
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "0 0 auto",
                  }}
                >
                  {check}
                </span>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#2b333f" }}>
                  {label}
                </span>
                <span style={{ fontSize: "11.5px", color: "#9aa3b0", fontWeight: 700 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remote segmented toggle */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginLeft: "4px" }}>
        <span
          style={{
            fontSize: "11.5px",
            color: "#8a93a3",
            fontWeight: 700,
            letterSpacing: ".2px",
          }}
        >
          REMOTE
        </span>
        <div
          style={{
            display: "inline-flex",
            background: "#eef1f5",
            borderRadius: "9px",
            padding: "2px",
          }}
        >
          {REMOTE_DEFS.map(([v, label]) => {
            const on = remote === v;
            return (
              <button
                key={v}
                onClick={() => onSetRemote(v)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "12px",
                  padding: "5px 11px",
                  borderRadius: "7px",
                  background: on ? "#ffffff" : "transparent",
                  color: on ? "#1b2330" : "#6b7480",
                  boxShadow: on ? "0 1px 3px rgba(20,28,40,.12)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Applied view toggle — switches the list to jobs marked applied */}
      {onToggleApplied && (
        <button
          onClick={onToggleApplied}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: appliedView ? "#2f7d54" : "#39424f",
            background: appliedView ? "#e3f1e9" : "#ffffff",
            border: `1px solid ${appliedView ? "#cfe6d8" : "#dfe3ea"}`,
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Applied{appliedCount ? ` · ${appliedCount}` : ""}
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Result count */}
      <div
        style={{
          fontSize: "12.5px",
          color: "#8a93a3",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {visibleCount} of {jobs.length} roles
      </div>

      {/* Sort */}
      <div data-menuroot="" style={{ position: "relative" }}>
        <button
          onClick={() => onToggleMenu("sort")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontWeight: 600,
            fontSize: "12.5px",
            color: "#39424f",
            background: "#fff",
            border: "1px solid #dfe3ea",
            borderRadius: "9px",
            padding: "7px 11px",
            cursor: "pointer",
          }}
        >
          Sort: {sortLabel}
          <span style={{ color: "#9aa3b0", fontSize: "9px" }}>▼</span>
        </button>
        {openMenu === "sort" && (
          <div style={{ ...dropdownBase, right: 0, width: "188px" }}>
            {SORT_DEFS.map(([v, label]) => {
              const r = radio(sort === v);
              return (
                <div
                  key={v}
                  onClick={() => onSetSort(v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: r.bg,
                  }}
                >
                  <span
                    style={{ flex: 1, fontSize: "13px", fontWeight: r.weight, color: "#2b333f" }}
                  >
                    {label}
                  </span>
                  <span style={{ color: "#3b6fd4", fontWeight: 800, fontSize: "12px" }}>
                    {r.check}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
