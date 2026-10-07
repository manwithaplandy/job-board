import { beforeEach, expect, test, vi } from "vitest";
import type { TransactionSql } from "postgres";
import { readPrivateSnapshot } from "./jobLifecycle";

const query = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({
  withUserDemandSql: (_user: string, fn: (tx: unknown, legacy: boolean) => unknown) => fn(query, false),
}));
beforeEach(() => query.mockReset());

for (const source of ["application_packages", "job_reviews"] as const) {
  test(`${source}: existing unknown provenance never adopts a later demand`, async () => {
    query.mockResolvedValueOnce([{ job_version_id: null, description_snapshot: null, questions_snapshot: null, snapshot_captured_at: null }]);
    query.mockResolvedValueOnce([{ job_version_id: "later", description_snapshot: "Later JD", questions_snapshot: null, snapshot_captured_at: "later" }]);
    const snapshot = await readPrivateSnapshot(query as unknown as TransactionSql, "job", source);
    expect(snapshot).toMatchObject({ versionId: null, description: null, capturedAt: null });
    expect(query).toHaveBeenCalledTimes(1);
  });
}
test("independent legacy snapshot survives without a fabricated version", async () => {
  query.mockResolvedValueOnce([{ job_version_id: null, description_snapshot: "Saved legacy JD", questions_snapshot: null, snapshot_captured_at: null }]);
  expect(await readPrivateSnapshot(query as unknown as TransactionSql, "job", "job_reviews"))
    .toMatchObject({ versionId: null, description: "Saved legacy JD" });
});
