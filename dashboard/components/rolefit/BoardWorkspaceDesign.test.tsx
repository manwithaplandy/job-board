// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

describe("board workspace design contract", () => {
  test("the board exposes stable responsive list and detail regions", () => {
    const source = read("./RolefitBoard.tsx");
    expect(source).toContain('className="rf-board-workspace"');
    expect(source).toContain('className="rf-board-list-pane');
    expect(source).toContain('className="rf-board-detail-pane');
    expect(source).toContain('className="rf-board-mobile-back"');
  });

  test("filters expose a compact scroll-safe toolbar and use the shared segmented control", () => {
    const source = read("./FilterBar.tsx");
    expect(source).toContain('className="rf-board-filters"');
    expect(source).toContain('className="rf-board-filter-strip"');
    expect(source).toContain("<SegmentedControl");
  });

  test("cards expose one selection treatment and semantic status markers", () => {
    const source = read("./JobCard.tsx");
    expect(source).toContain('data-selected={selected || undefined}');
    expect(source).toContain('className="rf-job-card__button');
    expect(source).toContain('className="rf-job-card__score');
    expect(source).not.toContain("cardBg");
    expect(source).not.toContain("cardShadow");
  });

  test("detail and generation surfaces expose overflow-safe structural classes", () => {
    expect(read("./JobDetail.tsx")).toContain('className="rf-job-detail"');
    expect(read("./ApplicationPanel.tsx")).toContain("rf-generation-panel");
    expect(read("./ResumePanel.tsx")).toContain("rf-generation-panel");
    expect(read("./ReviewPanel.tsx")).toContain("rf-review-panel");
  });

  test("board CSS defines narrow full-width modes with no minimum-content overflow", () => {
    const css = read("./board.css");
    expect(css).toMatch(/\.rf-board-workspace\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-board-list-pane[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-board-detail-pane[^}]*min-width:\s*0/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.rf-board-workspace[^}]*display:\s*block/s);
    expect(css).toMatch(/\.rf-job-detail[^}]*overflow-wrap:\s*anywhere/s);
  });
});
