import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";

const css = readFileSync("components/secondary-surfaces.css", "utf8");
const adminPages = [
  "app/admin/tenants/page.tsx",
  "app/admin/invites/page.tsx",
  "app/admin/classification/page.tsx",
];

describe("admin console width", () => {
  // Guards the exact regression: a bare max-width can't grow width: min(100%, --content-reading).
  // The [{;\s] before `width:` anchors the property name so it CANNOT match inside `max-width:`
  // (the char before `width` there is `-`, not in the class) — i.e. re-introducing the dead rule
  // as `max-width: min(100%, var(--content-standard))` must FAIL this test, not pass it.
  test("--admin overrides width (not just max-width) so it actually widens", () => {
    expect(css).toMatch(
      /\.rf-secondary-wrap--admin\s*\{[^}]*[{;\s]width:\s*min\(100%,\s*var\(--content-standard\)\)/,
    );
  });

  // The widening only holds because both selectors are single-class (specificity 0,1,0),
  // so --admin beats the base width solely by appearing LATER in source order. A refactor
  // that hoists the modifier above the base (stylelint ordering, modifier grouping, a file
  // split) would silently revert all three admin pages to --content-reading while every
  // other assertion here still passes (test 1 only checks the rule text exists). Pin the order.
  // NOTE: the base must be matched as /\.rf-secondary-wrap\s*\{/ — a bare indexOf of
  // ".rf-secondary-wrap" is a prefix of the modifier and would match --wide/--admin instead.
  test("the base wrap precedes --admin so the cascade actually widens", () => {
    const baseIdx = css.search(/\.rf-secondary-wrap\s*\{/);
    const adminIdx = css.search(/\.rf-secondary-wrap--admin\s*\{/);
    expect(baseIdx).toBeGreaterThanOrEqual(0);
    expect(adminIdx).toBeGreaterThan(baseIdx);
  });

  // Encodes "all three tabs widen consistently" — catches a tab that forgets the modifier.
  test("all three admin tabs carry the --admin wide wrap", () => {
    for (const page of adminPages) {
      expect(readFileSync(page, "utf8")).toContain("rf-secondary-wrap--admin");
    }
  });

  // Guards the form-cap so a wide card can't re-stretch the launcher controls.
  // (max-width is correct here — this genuinely wants max-width.)
  test("the classification launcher form is width-capped", () => {
    expect(css).toMatch(
      /\.rf-classification-launcher\s*\{[^}]*max-width:\s*var\(--content-form\)/,
    );
  });

  // Same regression on the invites tab: the fields grid ends in an `auto` track, so
  // without a cap the stretch-auto-tracks step hands ALL the wide-card free space to
  // the "Save settings" Button (justify-self: stretch), ballooning it inside the 1200px
  // --admin wrap. The cap keeps it near its pre-widening width. Mirrors the launcher cap.
  test("the invite-settings fields grid is width-capped", () => {
    expect(css).toMatch(
      /\.rf-invite-settings-fields\s*\{[^}]*max-width:\s*var\(--content-form\)/,
    );
  });

  // Third form on the same widened wrap: the InviteGenerator grid (/admin/invites) ends
  // in an `auto` track, so inside the 1200px --admin wrap the stretch-auto-tracks step
  // would balloon the Note field and drift the "Generate" Button to the far right of the
  // card without this cap. It was the only one of the three form caps left unpinned, so a
  // refactor could drop it while every other assertion stayed green. Mirrors the launcher
  // and invite-settings caps. (The first `.rf-admin-form-grid {` in source is the base rule
  // carrying max-width; the media-query redeclarations only touch grid-template-columns.)
  test("the invite-generator form grid is width-capped", () => {
    expect(css).toMatch(
      /\.rf-admin-form-grid\s*\{[^}]*max-width:\s*var\(--content-form\)/,
    );
  });
});
