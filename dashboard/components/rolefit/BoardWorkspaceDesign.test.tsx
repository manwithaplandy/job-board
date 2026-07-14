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
    expect(source.match(/className="rf-board-filter-option rf-focusable"/g)).toHaveLength(6);
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
    expect(read("./ResumePanel.tsx")).toContain('className="rf-generation-actions"');
    expect(read("./ResumeScorePanel.tsx")).toContain('className="rf-resume-score-row"');
    expect(read("./ResumeScorePanel.tsx")).toContain('className="rf-generation-actions"');
    expect(read("./CoverLetterEditor.tsx").match(/className="rf-generation-actions"/g)).toHaveLength(2);
  });

  test("board CSS defines narrow full-width modes with no minimum-content overflow", () => {
    const css = read("./board.css");
    expect(css).toMatch(/\.rf-board-workspace\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-board-list-pane[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-board-detail-pane[^}]*min-width:\s*0/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.rf-board-workspace[^}]*display:\s*block/s);
    expect(css).toMatch(/\.rf-job-detail[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.rf-generation-actions\s*\{[^}]*flex-wrap:\s*wrap[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.rf-resume-score-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*150px\)\s*repeat\(5,\s*44px\)/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*520px\)[\s\S]*\.rf-resume-score-row[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(44px,\s*1fr\)\)/s);
  });

  test("mobile popups use explicit containment anchors and 44px options", () => {
    const source = read("./FilterBar.tsx");
    const css = read("./board.css");
    expect(source).toContain('data-mobile-align={mobileAlign}');
    expect(source).toContain('mobileAlign="start"');
    expect(source).toContain('mobileAlign="end"');
    expect(css).not.toContain(":nth-child(even)");
    expect(css).toMatch(/data-mobile-align="start"[^}]*left:\s*0[^}]*right:\s*auto/s);
    expect(css).toMatch(/data-mobile-align="end"[^}]*right:\s*0[^}]*left:\s*auto/s);
    expect(css).toMatch(/\.rf-board-filter-option\s*\{[^}]*min-height:\s*var\(--target-size\)/s);
  });
});
