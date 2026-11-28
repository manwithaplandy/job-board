import { expect, type Locator, type Page } from "@playwright/test";

// Fix wave I3: a phone-width picture of an inline code (variant 3) view. A full-page
// screenshot of a sandbox frame below the fold shows the frame's box but not its content
// (the browser had not painted it), so the full-page baselines were no evidence that the
// inline flow works on a phone. The specs keep their full-page screenshot as it was (so its
// name and content stay stable) and then, where the page has an inline (not expanded)
// sandbox frame, take an element screenshot of that view frame, `.rf-view`, after
// scrolling it into view and waiting for the frame's document to fill itself in and paint.

/** The first view frame on the page that holds an inline sandbox frame, or null when there is none. */
export async function inlineSandboxView(page: Page): Promise<Locator | null> {
  const view = page.locator('.rf-view:not([data-expanded="true"])').filter({ has: page.locator("iframe.rf-sandbox__frame") }).first();
  return (await view.count()) > 0 ? view : null;
}

/**
 * Scrolls the view into view, waits until its frame's document shows text and has painted
 * (two animation frames inside the frame), then screenshots the view frame under `name`.
 */
export async function screenshotSandboxView(view: Locator, name: string) {
  await view.scrollIntoViewIfNeeded();
  const handle = await view.locator("iframe.rf-sandbox__frame").first().elementHandle({ timeout: 8_000 });
  const frame = handle ? await handle.contentFrame() : null;
  expect(frame, `${name}: the view's sandbox frame has a document`).not.toBeNull();
  await expect
    .poll(async () => (await frame!.locator("body").innerText().catch(() => "")).trim().length, {
      message: `${name}: the sandbox frame's document filled itself in`,
      timeout: 8_000,
    })
    .toBeGreaterThan(0);
  await frame!.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        setTimeout(resolve, 500);
      }),
  );
  await expect(view).toHaveScreenshot(name);
}
