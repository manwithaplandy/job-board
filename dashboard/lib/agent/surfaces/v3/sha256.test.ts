import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { sha256Base64 } from "@/lib/agent/surfaces/v3/sha256";

const node = (s: string) => createHash("sha256").update(s, "utf8").digest("base64");

describe("sha256Base64", () => {
  test.each([
    "",
    "abc",
    "a".repeat(55),
    "a".repeat(56),
    "a".repeat(64),
    "a".repeat(1000),
    "Résumé ✓ 履歴書 🎯",
    "/*nonce*/host.onInit(function () { document.body.textContent = 'x'; });",
  ])("matches node:crypto for %j", (s) => {
    expect(sha256Base64(s)).toBe(node(s));
  });
});
