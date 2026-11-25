// Display labels for workspace codes (skip reasons, tracker stages), shared by the
// workspace pages and, later, the agent page's blocks. Plain text only.
//
// Client components import this module, so it imports the server libraries for types
// only (a value import would pull the database module into the browser bundle).
import type { AGENT_SKIP_REASONS, USER_SKIP_REASONS } from "@/lib/workspaces/shortlist";
import type { ClosedReason, Stage } from "@/lib/workspaces/types";

type UserSkipReason = (typeof USER_SKIP_REASONS)[number];

/** In the order the skip picker offers them (the same order as USER_SKIP_REASONS). */
export const USER_SKIP_REASON_LABELS: Record<UserSkipReason, string> = {
  pay: "Pay",
  location: "Location",
  seniority: "Seniority",
  schedule: "Schedule",
  company: "Company",
  stack: "Tech stack",
  stale: "Posting too old",
  other: "Other",
};

export const AGENT_SKIP_REASON_LABELS: Record<(typeof AGENT_SKIP_REASONS)[number], string> = {
  red_flag: "Red flag",
  deal_breaker: "Deal-breaker",
  missing_pay: "No pay listed",
  posting_age: "Posting age",
};

export const USER_SKIP_REASON_ORDER = Object.keys(USER_SKIP_REASON_LABELS) as UserSkipReason[];

const SKIP_LABELS: Record<string, string> = { ...USER_SKIP_REASON_LABELS, ...AGENT_SKIP_REASON_LABELS };

/** The label for a stored reason code; an unknown code reads as "Other". */
export function skipReasonLabel(code: string | null): string | null {
  if (code === null) return null;
  return SKIP_LABELS[code] ?? "Other";
}

export const STAGE_LABELS: Record<Stage, string> = {
  preparing: "Preparing",
  ready: "Ready to apply",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

export const CLOSED_REASON_LABELS: Record<ClosedReason, string> = {
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  no_response: "No response",
};
