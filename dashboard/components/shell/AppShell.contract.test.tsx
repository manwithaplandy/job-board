import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("authenticated shell composition", () => {
  test("off-board route families compose AppShell", () => {
    for (const file of [
      "app/analytics/page.tsx",
      "app/companies/page.tsx",
      "app/billing/page.tsx",
      "app/profile/layout.tsx",
      "app/admin/tenants/page.tsx",
      "app/admin/invites/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain("<AppShell");
    }
  });

  test("board documents its intentional full-height composite shell exception", () => {
    const source = readFileSync("components/rolefit/RolefitBoard.tsx", "utf8");
    expect(source).toContain("BOARD_SHELL_COMPOSITE_EXCEPTION");
    expect(source).toContain('className="app-shell app-shell--board"');
  });
});
