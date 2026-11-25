import { expect, test, vi } from "vitest";

// Loading the libraries needs a database module; nothing here runs a query.
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(), withUserMutation: vi.fn() }));

import { ACTION_KINDS, registeredUndoKinds } from "@/lib/agent/actions/audit";

// The kinds whose library has landed. Every other kind answers undo with not_found
// until its library registers an undoer and joins undoers.ts.
const LANDED: readonly string[] = [];

test("every kind whose library has landed has an undoer once undoers.ts is loaded", async () => {
  const { UNDOABLE_KINDS } = await import("@/lib/agent/actions/undoers");
  expect([...UNDOABLE_KINDS].sort()).toEqual([...LANDED].sort());
  expect(registeredUndoKinds().sort()).toEqual([...LANDED].sort());
  for (const kind of LANDED) expect(ACTION_KINDS as readonly string[]).toContain(kind);
});
