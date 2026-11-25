"use client";

import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { AgentText, BlockFrame } from "./shared";

type ProfileReadback = Extract<V1Block, { type: "ProfileReadback" }>;

export const NO_PROFILE_TEXT = "Your profile was not read in this conversation.";

function yesNo(value: boolean | null): string {
  return value === null ? "Not stated" : value ? "Yes" : "No";
}

function list(values: string[]): string {
  return values.length === 0 ? "Not found" : values.join(" · ");
}

/**
 * "Here is what I read" (spec 5(a) step 4): the fixed facts of the profile summary
 * the turn read (name, titles, experience, education, locations, work authorization),
 * from the deterministic parser, never from payload text. The agent adds an optional
 * plain-text note; corrections happen by talking.
 */
export function ProfileReadbackBlock({ block, gathered }: { block: ProfileReadback; gathered: GatheredData }) {
  const p = gathered.profile;
  return (
    <BlockFrame title="What I read from your résumé" className="rf-block-profile">
      {p === null ? (
        <p className="rf-block__unavailable">{NO_PROFILE_TEXT}</p>
      ) : (
        <dl className="rf-block-facts">
          <div>
            <dt>Name</dt>
            <dd>{p.name ?? "Not found"}</dd>
          </div>
          <div>
            <dt>Titles</dt>
            <dd>{list(p.titles)}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{p.yearsOfExperience === null ? "Not found" : `${p.yearsOfExperience} years`}</dd>
          </div>
          <div>
            <dt>Education</dt>
            <dd>{list(p.education)}</dd>
          </div>
          <div>
            <dt>Preferred locations</dt>
            <dd>{list(p.preferredLocations)}</dd>
          </div>
          <div>
            <dt>Authorized to work</dt>
            <dd>{yesNo(p.workAuthorized)}</dd>
          </div>
          <div>
            <dt>Needs sponsorship</dt>
            <dd>{yesNo(p.needsSponsorship)}</dd>
          </div>
        </dl>
      )}
      {block.note && <AgentText text={block.note} />}
    </BlockFrame>
  );
}
