import { afterEach, describe, expect, test, vi } from "vitest";
import { sanitizeUploadFilename, resumeObjectPath } from "@/lib/resumeStorage";

// SECURITY (M-STORAGE-DELETE): a client-controlled filename with a path separator would
// nest the Storage object where the NON-recursive account-deletion sweep (list(userId),
// immediate children only) never sees it — so an erased user's résumé would survive
// erasure. sanitizeUploadFilename must guarantee no separator ever survives.
describe("sanitizeUploadFilename", () => {
  test("drops forward-slash directory parts, keeps the last segment", () => {
    expect(sanitizeUploadFilename("a/b/c.pdf")).toBe("c.pdf");
  });

  test("drops backslash directory parts", () => {
    expect(sanitizeUploadFilename("a\\b\\c.pdf")).toBe("c.pdf");
  });

  test("handles mixed separators", () => {
    expect(sanitizeUploadFilename("a/b\\c/d.pdf")).toBe("d.pdf");
  });

  test("neutralizes a ../ traversal payload to its final segment", () => {
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
  });

  test("collapses traversal dot-runs within the segment", () => {
    expect(sanitizeUploadFilename("my..resume...v2.pdf")).toBe("my.resume.v2.pdf");
  });

  test("strips control characters and NUL", () => {
    expect(sanitizeUploadFilename("re\x00su\x1fme\x7f.pdf")).toBe("resume.pdf");
  });

  test.each([
    ["///", "only separators"],
    ["\x00\x01\x1f", "only control chars"],
    ["   ", "only whitespace"],
    ["", "empty"],
  ])("falls back to resume.pdf for %j (%s)", (input) => {
    expect(sanitizeUploadFilename(input)).toBe("resume.pdf");
  });

  test("preserves a unicode filename", () => {
    expect(sanitizeUploadFilename("履歴書.pdf")).toBe("履歴書.pdf");
  });

  test("output NEVER contains a path separator (the security invariant)", () => {
    const hostiles = [
      "a/b/c.pdf", "a\\b\\c.pdf", "../../etc/passwd", "..\\..\\win.ini",
      "nested/deep/../../escape.pdf", "/leading.pdf", "trailing/", "\\\\server\\share\\f.pdf",
    ];
    for (const h of hostiles) {
      const out = sanitizeUploadFilename(h);
      expect(out).not.toContain("/");
      expect(out).not.toContain("\\");
    }
  });
});

describe("resumeObjectPath", () => {
  afterEach(() => vi.restoreAllMocks());

  test("builds `${userId}/${ts}-${sanitized}` with the sanitized name", () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    expect(resumeObjectPath("user-1", "resume.pdf")).toBe("user-1/1700000000000-resume.pdf");
  });

  test("a hostile filename yields a key with exactly ONE separator (a direct child of {userId}/)", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const key = resumeObjectPath("user-1", "a/b/c.pdf");
    // deleteStorageObjects enumerates only immediate children of {userId}/ — the object
    // MUST stay flat, so exactly one '/' (the userId boundary) and no backslash.
    expect(key).toBe("user-1/42-c.pdf");
    expect((key.match(/\//g) ?? []).length).toBe(1);
    expect(key).not.toContain("\\");
  });
});
