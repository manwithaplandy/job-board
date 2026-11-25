import { describe, expect, it } from "vitest";
// Next's own matcher for `headers()` sources. It is an internal module and may move on a
// Next upgrade; it is used anyway because a hand-written matcher could disagree with Next
// on exactly the edge this test is about (does "/agent/:path*" match "/agent"?).
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig, { SANDBOX_HOST_PATHS, headerRules } from "../next.config.mjs";
import { SANDBOX_LANES } from "../app/ui-gallery/sandbox-harness/fixtures";

type Rule = { source: string; headers: { key: string; value: string }[] };

/** The value Next sends for `key` on `path`: the last matching rule's (Next's documented override order). */
function sentValue(rules: Rule[], path: string, key: string): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (getPathMatch(rule.source)(path) === false) continue;
    const header = rule.headers.find((h) => h.key === key);
    if (header) value = header.value;
  }
  return value;
}

describe("security headers", () => {
  it("applies the baseline headers to every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all).toBeDefined();
    const byKey = Object.fromEntries(all!.headers.map((h) => [h.key, h.value]));
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(byKey["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("sandbox hosts get a later entry restating the full CSP plus frame-src 'none' (plan Task 2.7)", async () => {
    const rules = (await nextConfig.headers!()) as Rule[];
    const baseline = sentValue(rules, "/privacy", "Content-Security-Policy")!;
    expect(baseline).not.toContain("frame-src");
    expect(SANDBOX_HOST_PATHS).toEqual(["/agent/:path*", SANDBOX_LANES["frame-src-none"]]);
    for (const path of ["/agent", "/agent/threads/1", "/ui-gallery/sandbox-harness"]) {
      const csp = sentValue(rules, path, "Content-Security-Policy");
      expect(csp, path).toBe(`${baseline}; frame-src 'none'`);
      // Only the CSP is overridden; the other baseline headers still apply.
      expect(sentValue(rules, path, "X-Frame-Options"), path).toBe("DENY");
    }
    // The harness's baseline-csp lane must keep the site-wide CSP: it exists to test the
    // host's own teardown when the parent does not stop a self-navigation.
    for (const path of ["/", "/agentx", "/ui-gallery", "/ui-gallery/states/agent-empty", SANDBOX_LANES["baseline-csp"]]) {
      expect(sentValue(rules, path, "Content-Security-Policy"), path).toBe(baseline);
    }
    const lastIndex = rules.findIndex((r) => r.source === "/:path*");
    for (const source of SANDBOX_HOST_PATHS) expect(rules.findIndex((r) => r.source === source)).toBeGreaterThan(lastIndex);
  });

  it("the fallback version without the entry (if frame-src blocks srcdoc) sends the baseline CSP everywhere", () => {
    const rules = headerRules(false) as Rule[];
    expect(rules.map((r) => r.source)).toEqual(["/:path*"]);
    expect(sentValue(rules, "/agent", "Content-Security-Policy")).not.toContain("frame-src");
    expect(headerRules(true).map((r) => r.source)).toEqual(["/:path*", ...SANDBOX_HOST_PATHS]);
  });
});
