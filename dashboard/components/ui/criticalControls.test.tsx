import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const sourceRoot = resolve(process.cwd());

function source(path: string) {
  return readFileSync(resolve(sourceRoot, path), "utf8");
}

function productCode(path: string) {
  return source(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("critical control regressions", () => {
  test("résumé disclosure, form actions, and picker clears use shared controls", () => {
    expect(source("components/profile/ResumeSettingsForm.tsx")).not.toMatch(/<button\b/);
    expect(source("components/profile/SectionFormShell.tsx")).not.toMatch(/<button\b/);
    expect(source("components/LocationPicker.tsx")).not.toMatch(/<button\b/);
    expect(source("components/ModelPicker.tsx")).not.toMatch(/<button\b/);
    expect(source("components/rolefit/ResumeUploadField.tsx")).toContain("<FileUpload");
  });

  test("profile detail routes use the icon-backed BackLink primitive", () => {
    for (const path of [
      "app/profile/account/page.tsx",
      "app/profile/resume/page.tsx",
      "app/profile/application-personalization/page.tsx",
      "app/profile/application-details/page.tsx",
      "app/profile/job-preferences/page.tsx",
      "app/profile/advanced/page.tsx",
    ]) {
      const contents = source(path);
      expect(contents, path).toContain("<BackLink");
      expect(contents, path).not.toContain("← Back to profile");
    }
  });

  test("board controls do not render Unicode control glyphs", () => {
    const paths = [
      "components/rolefit/ApplicationPanel.tsx",
      "components/rolefit/CoverLetterEditor.tsx",
      "components/rolefit/FilterBar.tsx",
      "components/rolefit/GenerationInstructions.tsx",
      "components/rolefit/JobCard.tsx",
      "components/rolefit/JobDetail.tsx",
      "components/rolefit/ProfileModal.tsx",
      "components/rolefit/ResumePanel.tsx",
      "components/rolefit/ResumeScorePanel.tsx",
      "components/rolefit/ReviewPanel.tsx",
      "components/rolefit/ReviewNowPanel.tsx",
      "components/rolefit/RolefitBoard.tsx",
      "components/rolefit/UpsellNotice.tsx",
    ];
    const forbidden = /[←→▾▴▸▼▲✕×✓★✦✎△⤓↻●]/u;
    for (const path of paths) expect(productCode(path), path).not.toMatch(forbidden);
  });
});
