// Loads every library that registers an undoer (registerUndoer in audit.ts), so that
// undoAction can dispatch to it. audit.ts imports this module lazily, inside
// undoAction, which keeps audit.ts and the libraries from importing each other at load.
//
// Add a library here in the same commit that makes it call registerUndoer.
// Kinds whose library has not landed yet answer undo with not_found.
import "@/lib/workspaces/shortlist";
import "@/lib/workspaces/analyticsTiles";
import "@/lib/workspaces/applications";

/** The kinds this module's imports register (checked by undoers.test.ts). */
export const UNDOABLE_KINDS = ["shortlist.set", "analytics.set_tiles", "application.set_stage", "application.add_note"] as const;
