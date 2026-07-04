import { beforeEach, describe, expect, test, vi } from "vitest";

// These actions changed shape during the board-perf + apply-assist work:
//  - /api/resume and /api/cover-letter now persist regenerated content server-side,
//    so the client-side persistRegeneratedResume/Cover actions were removed.
//  - revalidatePath was dropped from the fine-grained optimistic actions (the client
//    updates optimistically and the board is force-dynamic), so mark/unmark no longer
//    trigger a full-page server re-render.
// This test guards the surviving behavior and the removal.

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUserId: vi.fn(async () => "9ae8b777-7c24-4290-8aad-bd2b10eff23b"),
  sql: vi.fn(async () => []),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: mocks.requireUserId,
}));

vi.mock("@/lib/db", () => ({
  // withUserSql drops into a transaction; the mock invokes the callback with the
  // recording `sql` fn so the actions' tx queries are captured.
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(mocks.sql),
}));

vi.mock("@/lib/queries", () => ({
  bareMarkerPredicate: () => "",
}));

describe("application package server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("markApplicationApplied writes under the authed user and does not revalidate", async () => {
    const { markApplicationApplied } = await import("@/app/actions/applications");

    await markApplicationApplied("job-1");

    expect(mocks.requireUserId).toHaveBeenCalled();
    expect(mocks.sql).toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("the client-side persist actions were removed (routes persist server-side)", async () => {
    const mod = (await import("@/app/actions/applications")) as Record<string, unknown>;

    expect(mod.persistRegeneratedResume).toBeUndefined();
    expect(mod.persistRegeneratedCover).toBeUndefined();
  });
});
