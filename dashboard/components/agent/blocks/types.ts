// Shared props for the variant 1 blocks (plan Tasks 1.18 and 1.19).
//
// Client modules import this file, so every server library is imported for its types
// only (a value import of lib/agent/surfaces/v1/blocks.ts or lib/agent/actions/intents.ts
// would pull the database module into the browser bundle).
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { MemoDoc, MemoProposal } from "@/lib/workspaces/types";

/** A press on a block: one intent from the closed enum, executed by the host. */
export type OnIntent = (intent: ActionIntent) => void;

/** The fixed line a block shows when its job is not in the turn's gathered data. */
export const UNAVAILABLE_TEXT = "This posting is no longer available";

/**
 * One job's application package as the host read it from the database. The jsonb
 * columns arrive as stored (`unknown`): the blocks parse them with the package codec's
 * total parsers, so a malformed row renders as "not ready" instead of crashing.
 */
export interface PackageView {
  status: "prepared" | "applied";
  /** application_packages.resume_json, unparsed. */
  resume: unknown;
  /** application_packages.cover_letter_json, unparsed. */
  coverLetter: unknown;
  /** The user's current edit of the cover letter (cover_letter_edits), when there is one. */
  coverLetterEditedText: string | null;
  /** application_packages.prefilled_answers, unparsed. */
  prefilledAnswers: unknown;
  /** application_packages.apply_url. */
  applyUrl: string | null;
  /** jobs.ats, for the "Apply on {ATS}" label. */
  ats: string | null;
}

/**
 * Database rows a block binds to that are not part of the turn's gathered data. The
 * host reads them for the user under RLS. Every field is optional: a block whose row is
 * missing renders a fixed line instead.
 */
export interface BlockRows {
  /**
   * The current memo with its version, and the user's pending proposals by proposal id
   * (MemoDiff). A proposal whose baseVersion is not `version` is out of date.
   */
  memo?: { current: MemoDoc; version: number; proposals: Record<string, MemoProposal> };
  /** Application packages, by job id (PrepChecklist, EvidenceMap, DocumentPreview). */
  packages?: Record<string, PackageView>;
  /**
   * The posting's stored Greenhouse question schema (job_questions.questions), unparsed,
   * by job id. PrepChecklist reads from it, by the rule startApplicationPrep charges by
   * (lib/rolefit/prepNeeds.ts), whether the posting asks for a cover letter or answers.
   */
  questions?: Record<string, unknown>;
  /** The catalog clock's now (catalogNow), ISO 8601, for StaleList's ages. */
  now?: string;
}
