// Agent page screenshots (PR K1). Renders the gallery's agent page fixtures
// (/ui-gallery/states/agent-page-*, components/agent/AgentPageFixture.tsx) at six widths in
// dark and light, saves a full-page PNG of each, and checks the layout: nothing wider than
// the viewport, and no overlap between the conversation list, the toolbar (variant
// switcher) and the transcript. Not part of CI or the visual-regression suite.
//
// Run against a production build:
//   npx next build --webpack
//   node --experimental-strip-types --no-warnings scripts/agent-screens.ts --out <dir>
// Options: --base <url> uses a server that is already running instead of starting
// `next start`; --states a,b limits the states; --widths 375,1280 limits the widths.
// Chromium comes from PLAYWRIGHT_BROWSERS_PATH; nothing is downloaded.
// Exit code 1 when any check fails; every failure is printed.

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const STATES = [
  "agent-page-empty",
  "agent-page-conversation",
  "agent-page-surface",
  "agent-page-failed",
  "agent-page-blocks",
  "agent-page-layout",
  "agent-page-code",
] as const;
// Not a gallery state: the conversation fixture after a live send whose turn fails
// (the route is stubbed with a model error), to show the error path as the user sees it.
const LIVE_FAILED = "agent-page-failed-live";
const WIDTHS = [375, 768, 1024, 1280, 1440, 2000];
const THEMES = ["dark", "light"] as const;
const HEIGHT = 1000;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function waitForServer(base: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(`${base}/ui-gallery/states/agent-page-empty`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${base} did not answer within ${timeoutMs} ms`);
}

/** One UI message stream whose turn fails with the server's reason code, as /api/agent sends it. */
function failedTurnBody(reason: string): string {
  const chunks = [{ type: "start", messageId: "msg-failed" }, { type: "error", errorText: reason }];
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}

type Box = { name: string; x: number; y: number; w: number; h: number };

async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > window.innerWidth) {
      problems.push(`page scrolls sideways: scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth}`);
    }
    // Anything visible that pokes out past the viewport's right edge.
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.position === "fixed") continue;
      if (el.closest(".sr-only, [aria-hidden='true']")) continue;
      if (r.right > vw + 1 || r.left < -1) {
        problems.push(`element past the viewport: <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
        break;
      }
    }
    const box = (name: string, selector: string): Box | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { name, x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const overlap = (a: Box, b: Box) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
    const boxes = [
      box("conversation list", ".rf-agent-threads"),
      box("toolbar", ".rf-agent-toolbar") ?? box("variant switcher", ".rf-agent-variants"),
      box("transcript", ".rf-agent-transcript"),
      box("composer", ".rf-agent-composer"),
      box("latest view", ".rf-agent-surface-column"),
    ].filter((b): b is Box => b !== null);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (overlap(boxes[i], boxes[j])) problems.push(`${boxes[i].name} overlaps ${boxes[j].name}`);
      }
    }
    // Each thread link stays inside the conversation list.
    const list = box("conversation list", ".rf-agent-threads");
    if (list) {
      for (const el of document.querySelectorAll(".rf-agent-threads a, .rf-agent-threads button")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > list.x + list.w + 1 || r.left < list.x - 1) {
          problems.push(`"${(el.textContent ?? "").trim().slice(0, 40)}" runs outside the conversation list`);
        }
      }
    }
    // Interactive targets under 44 px (the visual suite's rule).
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
    };
    for (const el of document.querySelectorAll("button,a[href],[role=radio],textarea,.rf-button")) {
      if (!visible(el) || el.matches(".rf-file-upload__input")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) problems.push(`target under 44px: <${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return problems;
  });
}

async function main(): Promise<void> {
  const out = arg("out");
  if (!out) throw new Error("--out <dir> is required");
  mkdirSync(out, { recursive: true });
  const states = arg("states")?.split(",") ?? [...STATES, LIVE_FAILED];
  const widths = arg("widths")?.split(",").map(Number) ?? WIDTHS;
  let base = arg("base");
  let server: ChildProcess | null = null;
  if (!base) {
    const port = 3210;
    base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], { stdio: "ignore", env: process.env });
  }
  const failures: string[] = [];
  try {
    await waitForServer(base, 90_000);
    const browser = await chromium.launch();
    try {
      for (const theme of THEMES) {
        for (const width of widths) {
          const context = await browser.newContext({ viewport: { width, height: HEIGHT }, colorScheme: theme });
          await context.addInitScript((t) => {
            localStorage.setItem("rolefit-theme", t);
            document.documentElement.dataset.theme = t;
          }, theme);
          const page = await context.newPage();
          await page.route("**/api/agent", (route) =>
            route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: failedTurnBody("model_error:402") }),
          );
          await page.route("**/api/review/request**", (route) => route.fulfill({ status: 200, json: { status: null } }));
          for (const state of states) {
            const gallery = state === LIVE_FAILED ? "agent-page-conversation" : state;
            await page.goto(`${base}/ui-gallery/states/${gallery}`, { waitUntil: "networkidle" });
            if (state === LIVE_FAILED) {
              await page.getByLabel(/^Message/).fill("Show me remote platform roles.");
              await page.getByRole("button", { name: "Send" }).click();
              await page.waitForSelector(".rf-agent-turn-error, .rf-alert", { timeout: 10_000 });
            }
            await page.waitForTimeout(150);
            const problems = await layoutProblems(page);
            const name = `${state}-${width}-${theme}`;
            await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
            for (const p of problems) failures.push(`${name}: ${p}`);
            console.log(`${problems.length === 0 ? "ok  " : "FAIL"} ${name}${problems.length ? `\n      ${problems.join("\n      ")}` : ""}`);
          }
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server?.kill();
  }
  console.log(`\n${failures.length === 0 ? "All layout checks passed." : `${failures.length} layout problem(s).`}`);
  if (failures.length > 0) process.exitCode = 1;
}

void main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
