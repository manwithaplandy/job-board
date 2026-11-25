// canMountSandbox (fix round 1, I5): the one gate the Task 2.8 host uses before it mounts
// SandboxFrame (plan note R15).
import { describe, expect, test } from "vitest";
import { canMountSandbox, type MountableRow } from "@/lib/agent/surfaces/v3/mount";

const HTML = "<h1>Picks</h1><div id=\"list\"></div><script>host.onInit(function (data) { void data; });</script>";
const FALLBACK = { variant: 1, title: "Picks", blocks: [] };

function row(over: Partial<MountableRow> = {}): MountableRow {
  return {
    variant: 3,
    outcome: "valid",
    failure: null,
    payload: { variant: 3, title: "Picks", html: HTML },
    fallbackPayload: FALLBACK,
    ...over,
  };
}

describe("canMountSandbox", () => {
  test("passes a valid or repaired variant 3 row with no failure and a fallback", () => {
    expect(canMountSandbox(row())).toBe(true);
    expect(canMountSandbox(row({ outcome: "repaired" }))).toBe(true);
  });

  test("refuses any other variant", () => {
    expect(canMountSandbox(row({ variant: 1 }))).toBe(false);
    expect(canMountSandbox(row({ variant: 2 }))).toBe(false);
  });

  test("refuses a row whose outcome is fallback or that has a failure recorded", () => {
    expect(canMountSandbox(row({ outcome: "fallback" }))).toBe(false);
    expect(canMountSandbox(row({ failure: "no_handshake" }))).toBe(false);
    expect(canMountSandbox(row({ failure: "" }))).toBe(false);
  });

  test("refuses a row with no fallback payload to fall back to", () => {
    expect(canMountSandbox(row({ fallbackPayload: null }))).toBe(false);
  });

  test("refuses a payload the variant 3 validator rejects today", () => {
    expect(canMountSandbox(row({ payload: { variant: 3, title: "Picks" } }))).toBe(false);
    expect(canMountSandbox(row({ payload: { variant: 3, title: "Picks", html: "<iframe></iframe>" } }))).toBe(false);
    expect(canMountSandbox(row({ payload: { variant: 3, title: "Picks", html: "<script>fetch('x')</script>" } }))).toBe(false);
    expect(canMountSandbox(row({ payload: { variant: 3, title: "Picks", html: "<p>ok</p>", extra: 1 } }))).toBe(false);
  });

  test("refuses nothing at all", () => {
    expect(canMountSandbox(null)).toBe(false);
    expect(canMountSandbox(undefined)).toBe(false);
  });
});
