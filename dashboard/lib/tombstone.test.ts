import { describe, expect, test, vi, beforeEach } from "vitest";

// assertNotDeleted / isAccountDeleted read the service-role-only account_deletions
// tombstone. Mock serviceSql (the RLS-bypass pool) to return a controllable EXISTS.
const state = vi.hoisted(() => ({ deleted: false }));
vi.mock("@/lib/db", () => ({
  // tombstone.ts calls serviceSql as a tagged template: serviceSql`SELECT EXISTS(...)`.
  serviceSql: (..._a: unknown[]) => Promise.resolve([{ deleted: state.deleted }]),
}));

import { assertNotDeleted, isAccountDeleted, AccountDeletedError } from "@/lib/tombstone";

beforeEach(() => {
  state.deleted = false;
});

describe("tombstone guard", () => {
  test("isAccountDeleted reflects the ledger EXISTS", async () => {
    state.deleted = true;
    expect(await isAccountDeleted("u1")).toBe(true);
    state.deleted = false;
    expect(await isAccountDeleted("u1")).toBe(false);
  });

  test("assertNotDeleted resolves for a live account", async () => {
    state.deleted = false;
    await expect(assertNotDeleted("u1")).resolves.toBeUndefined();
  });

  test("assertNotDeleted throws AccountDeletedError for a tombstoned account", async () => {
    state.deleted = true;
    await expect(assertNotDeleted("u1")).rejects.toBeInstanceOf(AccountDeletedError);
  });
});
