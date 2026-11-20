import { describe, expect, test } from "vitest";
import { assertSnapshotUpdatePlatform } from "./snapshot-platform-guard";

describe("snapshot update platform guard", () => {
  test.each([["--update-snapshots"], ["-u"], ["--update-snapshots=all"]])(
    "refuses %s off Linux",
    (flag) => {
      expect(() =>
        assertSnapshotUpdatePlatform(["playwright", "test", flag], "darwin"),
      ).toThrow(/Linux/);
    },
  );

  test("allows updates on Linux and ordinary runs anywhere", () => {
    expect(() => assertSnapshotUpdatePlatform(["test", "-u"], "linux")).not.toThrow();
    expect(() => assertSnapshotUpdatePlatform(["test"], "darwin")).not.toThrow();
    expect(() =>
      assertSnapshotUpdatePlatform(["test", "--ui"], "win32"),
    ).not.toThrow();
  });
});
