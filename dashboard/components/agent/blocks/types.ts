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
 * Database rows a block binds to that are not part of the turn's gathered data. The
 * host reads them for the user under RLS. Every field is optional: a block whose row is
 * missing renders a fixed line instead.
 */
export interface BlockRows {
  /** The current memo and the user's pending proposals, by proposal id (MemoDiff). */
  memo?: { current: MemoDoc; proposals: Record<string, MemoProposal> };
}
