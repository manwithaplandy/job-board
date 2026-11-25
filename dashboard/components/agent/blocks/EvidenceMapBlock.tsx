"use client";

import { Badge } from "@/components/ui/Panel";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";
import { packageFields } from "./packageFields";
import { AgentText, BlockFrame, Unavailable, own } from "./shared";
import type { BlockRows } from "./types";

type EvidenceMap = Extract<V1Block, { type: "EvidenceMap" }>;

/**
 * Requirement to evidence (spec 5(c) step 3). Each requirement's text comes from the
 * job's review in gathered data, picked by index; the agent supplies only the evidence
 * sentence (plain text) and whether it is a gap. When the review itself marked a
 * requirement unmet that the agent did not call a gap, both are shown. Under the map,
 * the tailored résumé's failed mechanical checks (resumeChecks) are listed.
 */
export function EvidenceMapBlock({ block, gathered, rows }: { block: EvidenceMap; gathered: GatheredData; rows: BlockRows }) {
  const job = own(gathered.jobs, block.jobId);
  const review = own(gathered.reviews, block.jobId);
  if (!job || !review) {
    return (
      <BlockFrame title="Requirements and evidence" className="rf-block-evidence">
        <Unavailable />
      </BlockFrame>
    );
  }
  const { resume } = packageFields(rows.packages ? own(rows.packages, block.jobId) : null);
  const checks = resume ? resumeChecks(resume) : null;
  const failed = checks ? checks.checks.filter((c) => !c.pass) : [];
  const gaps = block.rows.filter((r) => r.gap).length;
  return (
    <BlockFrame title={`Requirements and evidence for ${job.title}`} className="rf-block-evidence">
      <p className="rf-block-evidence__summary">
        {gaps === 0 ? "No gaps noted." : gaps === 1 ? "1 gap noted." : `${gaps} gaps noted.`}
      </p>
      <ol className="rf-block-evidence__list">
        {block.rows.map((row, i) => {
          const requirement = review.requirements[row.requirementIndex];
          if (!requirement) return null;
          return (
            <li key={i} className={["rf-block-evidence__row", row.gap ? "rf-block-evidence__row--gap" : ""].filter(Boolean).join(" ")}>
              <div className="rf-block-evidence__head">
                <span className="rf-block-evidence__requirement">{requirement.text}</span>
                <Badge tone={row.gap ? "warning" : "success"}>{row.gap ? "Gap" : "Evidence"}</Badge>
              </div>
              <AgentText text={row.evidence} />
              {!row.gap && !requirement.met && <p className="rf-block-evidence__note">The review marked this requirement as not met.</p>}
            </li>
          );
        })}
      </ol>
      {checks && (
        <div className="rf-block__labelled">
          <p className="rf-block__label">Résumé checks</p>
          {failed.length === 0 ? (
            <p className="rf-block-evidence__summary">{`All ${checks.total} checks pass.`}</p>
          ) : (
            <ul className="rf-block-evidence__checks" aria-label="Failed résumé checks">
              {failed.map((c) => (
                <li key={c.id}>{c.detail ? `${c.label} (${c.detail})` : c.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
