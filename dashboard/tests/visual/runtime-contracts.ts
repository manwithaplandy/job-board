import { expect, type Page } from "@playwright/test";

// The runtime contracts every screenshot spec checks against the full, unmodified page
// before it takes a screenshot: no document overflow, no browser-default controls, every
// interactive target at least 44px in both dimensions, and SVGs only from the internal
// icon set or a data-viz wrapper. Shared by ui-cohesion.spec.ts and
// agent-page-widths.spec.ts (a module, not a spec, so its checks run once per caller).
export async function assertRuntimeContracts(page: Page) {
  const runtime = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const defaultControls = [...document.querySelectorAll("button,input:not([type=hidden]),select,textarea")]
      .filter(visible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.fontFamily === "serif" || style.backgroundColor === "rgb(239, 239, 239)" || (element.tagName === "SELECT" && style.appearance === "auto");
      }).map((element) => element.outerHTML.slice(0, 180));
    const undersized = [...document.querySelectorAll("button,a[href],[role=button],[role=menuitem],[role=tab],[role=radio],input:not([type=hidden]),select,textarea,.rf-button,.rf-icon-button")]
      .filter(visible)
      .filter((element) => !(element.tagName === "A" && element.closest(".rf-reading-content,.rf-entry-consent")))
      // The 1px native file input delegates its focusable 44px hit target to the
      // immediately following styled label (the documented FileUpload composite).
      .filter((element) => !(element.matches(".rf-file-upload__input") && element.nextElementSibling?.matches("label.rf-button")))
      .filter((element) => {
        // A native checkbox/radio wrapped in its <label> is activated by a click anywhere
        // on that label, so the label is the hit target that must meet the 44px minimum.
        const target = element.matches("input[type=checkbox],input[type=radio]") && element.parentElement?.tagName === "LABEL" ? element.parentElement : element;
        const rect = target.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).map((element) => ({
        tag: element.tagName,
        className: element.getAttribute("class"),
        label: element.getAttribute("aria-label") ?? ((element as HTMLInputElement).labels?.[0]?.textContent ?? element.textContent)?.trim().slice(0, 50),
      }));
    const rawSvgs = [...document.querySelectorAll("svg:not(.rf-icon)")].filter((element) => !element.hasAttribute("data-fit-score-ring") && !element.closest('[data-ui-visual="data-viz"]'));
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      defaultControls,
      undersized,
      rawSvgCount: rawSvgs.length,
      shellCount: document.querySelectorAll('[data-testid="app-shell"],.app-shell--board').length,
    };
  });
  expect(runtime.scrollWidth, `document overflow: ${JSON.stringify(runtime)}`).toBeLessThanOrEqual(runtime.viewport);
  expect(runtime.defaultControls, "browser-default controls").toEqual([]);
  expect(runtime.undersized, "interactive targets under 44px").toEqual([]);
  expect(runtime.rawSvgCount, "SVGs outside the internal icon/data-viz exceptions").toBe(0);
  return runtime;
}
