import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

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
});
