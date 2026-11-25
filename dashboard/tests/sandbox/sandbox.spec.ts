// Real-browser enforcement tests for the variant 3 sandbox (plan Task 2.7; spec 10
// "Variant 3 sandbox"; PR J2 report "Open for Task 2.7" and "Task 2.7 canary cases for I1";
// PR J2 review "For Task 2.7"). Each case opens the public harness page
// (app/ui-gallery/sandbox-harness) of a production build with one hostile document from
// fixtures.ts in the production SandboxFrame, and checks:
//   - the frame ran at all (its "start" probe), so a zero is not vacuous;
//   - the canary (canary-server.mjs) saw nothing: no TCP connection, HTTP request,
//     WebSocket upgrade or UDP datagram. A navigation that reaches the canary is a hit even
//     where spec 10 accepts a one-request residual; gate A18 is decided from these results;
//   - every frame is still at about:srcdoc, or the host has already removed it;
//   - what the case itself is about (storage throws, policies hold, chip timing, ...).
// Three controls show that the canary is reachable from the harness page and from a plain
// sandboxed srcdoc frame, and record (without asserting) what a document without the kit
// would allow.
//
// Every case writes test-results/sandbox/results/<browser>--<title>.json with the probes,
// the canary record, the frames' state, the harness logs and the outcome, whether it passed
// or failed. Cases run one at a time (one worker) because the canary's record is shared.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { HARNESS_JOB_A, HARNESS_JOB_B, SANDBOX_CANARY_ORIGIN, sandboxCase, type SandboxCaseName } from "../../app/ui-gallery/sandbox-harness/fixtures";
import { buildSandboxDocument, newSandboxNonce } from "../../lib/agent/surfaces/v3/document";
import {
  SANDBOX_RESULTS_DIR,
  hasProbe,
  mergeProbes,
  parseProbe,
  probeValue,
  resultFileName,
  summariseHits,
  threw,
  type CanaryHits,
  type Probe,
} from "./results";

const CONTROL = "http://127.0.0.1:4598";
const HARNESS = "/ui-gallery/sandbox-harness";
/** After a case says "done": time for late requests (prefetch, beacon, refresh) to arrive. */
const SETTLE_MS = 2_000;
/** Navigation cases: longer than the handshake (3 s) and a missed pong (1 s + 2.5 s). */
const NAV_WAIT_MS = 6_000;
/** SandboxFrame's CHIP_ARM_MS, plus margin. */
const ARMED_AFTER_MS = 900;

interface FrameState {
  index: number;
  present: boolean;
  url: string | null;
  styleHeight: string | null;
}

interface CaseRecord {
  browser: string;
  case: string;
  parentCsp: string | null;
  parentFrameSrcNone: boolean | null;
  probes: Probe[];
  hits: CanaryHits | null;
  frames: FrameState[];
  intents: unknown[];
  fallbacks: unknown[];
  reports: unknown[];
  popups: string[];
  pageUrlAfter: string | null;
  notes: string[];
}

let current: CaseRecord | null = null;

class CaseRun {
  readonly consoleProbes: Probe[] = [];
  domProbes: Probe[] = [];
  readonly record: CaseRecord;

  constructor(
    readonly page: Page,
    readonly request: APIRequestContext,
    readonly browser: string,
    readonly name: string,
  ) {
    this.record = {
      browser, case: name, parentCsp: null, parentFrameSrcNone: null, probes: [], hits: null, frames: [],
      intents: [], fallbacks: [], reports: [], popups: [], pageUrlAfter: null, notes: [],
    };
  }

  get probes(): Probe[] {
    return mergeProbes(this.consoleProbes, this.domProbes);
  }

  /** The prefix of every assertion message: browser and case, because CI output is the only evidence. */
  get at(): string {
    return `[${this.browser}] ${this.name}`;
  }

  note(text: string) {
    this.record.notes.push(text);
  }
}

async function resetCanary(request: APIRequestContext) {
  const res = await request.post(`${CONTROL}/reset`);
  expect(res.ok(), "the canary's control API answered the reset").toBe(true);
}

async function readHits(request: APIRequestContext): Promise<CanaryHits> {
  const res = await request.get(`${CONTROL}/hits`);
  expect(res.ok(), "the canary's control API answered").toBe(true);
  return (await res.json()) as CanaryHits;
}

async function startCase(page: Page, request: APIRequestContext, browser: string, name: string): Promise<CaseRun> {
  await resetCanary(request);
  const run = new CaseRun(page, request, browser, name);
  page.on("console", (message) => {
    const probe = parseProbe(message.text());
    if (probe) run.consoleProbes.push(probe);
  });
  page.on("popup", (popup) => run.record.popups.push(popup.url()));
  current = run.record;
  return run;
}

async function openHarness(run: CaseRun, caseName: SandboxCaseName | null) {
  const response = await run.page.goto(caseName ? `${HARNESS}?case=${caseName}` : HARNESS, { waitUntil: "load" });
  expect(response?.status(), `${run.at}: the harness page answered`).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? null;
  run.record.parentCsp = csp;
  run.record.parentFrameSrcNone = csp === null ? null : /(?:^|;)\s*frame-src 'none'/.test(csp);
  await expect(run.page.locator(`[data-sandbox-harness="${caseName ?? "index"}"]`)).toBeVisible();
}

async function readDomProbes(page: Page): Promise<Probe[]> {
  const out: Probe[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const text = await frame.locator("#probe").textContent({ timeout: 500 });
      for (const line of (text ?? "").split("\n")) {
        const probe = parseProbe(line);
        if (probe) out.push(probe);
      }
    } catch {
      // The frame navigated away or was removed: its console lines are all there is.
    }
  }
  return out;
}

/** Waits for a probe without failing; returns whether it came. */
async function waitForProbe(run: CaseRun, tag: string, key: string, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  let lastDomRead = 0;
  while (Date.now() < end) {
    if (hasProbe(run.probes, tag, key)) return true;
    if (Date.now() - lastDomRead > 1_000) {
      run.domProbes = mergeProbes(run.domProbes, await readDomProbes(run.page));
      lastDomRead = Date.now();
    }
    await run.page.waitForTimeout(100);
  }
  return hasProbe(run.probes, tag, key);
}

async function frameStates(page: Page): Promise<FrameState[]> {
  const holders = page.locator("[data-sandbox-surface]");
  const out: FrameState[] = [];
  const n = await holders.count();
  for (let index = 0; index < n; index++) {
    const iframe = holders.nth(index).locator("iframe");
    if ((await iframe.count()) === 0) {
      out.push({ index, present: false, url: null, styleHeight: null });
      continue;
    }
    const handle = await iframe.elementHandle({ timeout: 1_000 }).catch(() => null);
    const frame = handle ? await handle.contentFrame() : null;
    const styleHeight = handle ? await handle.evaluate((el) => (el as HTMLElement).style.height).catch(() => null) : null;
    out.push({ index, present: handle !== null, url: frame ? frame.url() : null, styleHeight });
  }
  return out;
}

async function harnessLog(page: Page, kind: "intents" | "fallbacks" | "reports"): Promise<unknown[]> {
  const text = await page.locator(`output[data-sandbox-log="${kind}"]`).textContent().catch(() => null);
  try {
    const parsed: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Lets late requests arrive, then records the probes, the frames, the harness logs and the canary. */
async function finishCase(run: CaseRun, settleMs: number) {
  await run.page.waitForTimeout(settleMs);
  run.domProbes = mergeProbes(run.domProbes, await readDomProbes(run.page));
  run.record.frames = await frameStates(run.page);
  run.record.intents = await harnessLog(run.page, "intents");
  run.record.fallbacks = await harnessLog(run.page, "fallbacks");
  run.record.reports = await harnessLog(run.page, "reports");
  run.record.pageUrlAfter = run.page.url();
  run.record.hits = await readHits(run.request);
  run.record.probes = run.probes;
}

function expectRan(run: CaseRun, tag: string = run.name) {
  expect(
    hasProbe(run.probes, tag, "start"),
    `${run.at}: the frame "${tag}" never ran (no "start" probe), so nothing it should have tried was tried. ` +
      `If every case shows this, the parent's CSP blocks the srcdoc load itself in this browser (parent CSP: ${run.record.parentCsp}).`,
  ).toBe(true);
}

function expectNoHits(run: CaseRun) {
  const hits = run.record.hits;
  expect(hits, `${run.at}: the canary record was read`).not.toBeNull();
  expect(hits!.total, `${run.at}: the canary saw ${summariseHits(hits!)}`).toBe(0);
}

/** frame.url() is still about:srcdoc, or the host has already removed the frame. */
function expectContained(run: CaseRun) {
  for (const f of run.record.frames) {
    expect(!f.present || f.url === "about:srcdoc", `${run.at}: frame ${f.index} is at ${f.url} and the host has not removed it`).toBe(true);
  }
}

function expectThrew(run: CaseRun, tag: string, key: string, what: string) {
  expect(threw(run.probes, tag, key), `${run.at}: ${what} (probe ${key}: ${JSON.stringify(probeValue(run.probes, tag, key))})`).toBe(true);
}

/** The standard hostile case: open, wait for "done" (or the wait), settle, then the three checks. */
async function hostileCase(run: CaseRun, caseName: SandboxCaseName, waitMs: number, settleMs = SETTLE_MS) {
  await openHarness(run, caseName);
  await waitForProbe(run, caseName, "done", waitMs);
  await finishCase(run, settleMs);
  expectRan(run, caseName);
  expectNoHits(run);
  expectContained(run);
}

test.afterEach(async ({ browserName }, testInfo) => {
  if (!current) return;
  const out = {
    ...current,
    browser: current.browser || browserName,
    title: testInfo.title,
    status: testInfo.status,
    expectedStatus: testInfo.expectedStatus,
    durationMs: testInfo.duration,
    errors: testInfo.errors.map((e) => (e.message ?? String(e.value ?? "")).slice(0, 2_000)),
    annotations: testInfo.annotations,
  };
  const body = JSON.stringify(out, null, 2);
  mkdirSync(SANDBOX_RESULTS_DIR, { recursive: true });
  writeFileSync(path.join(SANDBOX_RESULTS_DIR, resultFileName(out.browser, testInfo.title)), body);
  await testInfo.attach("sandbox-result", { body, contentType: "application/json" });
  current = null;
});

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

test.describe("controls", () => {
  test("control-top: the canary counts requests from the harness page itself", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-top");
    await openHarness(run, null);
    await page.evaluate((origin) => {
      fetch(`${origin}/c/control-top/fetch`, { mode: "no-cors" }).catch(() => {});
      new Image().src = `${origin}/c/control-top/img`;
    }, SANDBOX_CANARY_ORIGIN);
    await finishCase(run, SETTLE_MS);
    expect(run.record.hits!.requests.length, `${run.at}: the canary saw nothing from the top page, so every zero below would mean nothing`).toBeGreaterThan(0);
  });

  test("control-plain-frame: a sandboxed srcdoc frame without the CSP or kit reaches the canary", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-plain-frame");
    await openHarness(run, null);
    await page.evaluate((origin) => {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts");
      f.srcdoc =
        "<script>" +
        `fetch("${origin}/c/control-plain-frame/fetch", { mode: "no-cors" }).catch(function () {});` +
        `new Image().src = "${origin}/c/control-plain-frame/img";` +
        "</scr" + "ipt>";
      document.body.appendChild(f);
    }, SANDBOX_CANARY_ORIGIN);
    await finishCase(run, SETTLE_MS);
    expect(
      run.record.hits!.requests.length,
      `${run.at}: a plain sandboxed srcdoc frame on the harness page made no request. Either the parent's CSP ` +
        `(${run.record.parentCsp}) blocks srcdoc frames in this browser, or opaque-origin frames cannot reach the canary here; ` +
        "either way the zero-hit cases prove nothing in this browser.",
    ).toBeGreaterThan(0);
  });

  for (const variant of ["as built", "without the Trusted Types directives"] as const) {
    test(`control-no-kit (${variant}): what copying the nonce and a hash from the metas allows without the kit (recorded, not asserted)`, async ({
      page,
      request,
      browserName,
    }, testInfo) => {
      const run = await startCase(page, request, browserName, `control-no-kit-${variant === "as built" ? "built" : "no-tt"}`);
      await openHarness(run, null);
      let srcdoc = buildSandboxDocument({
        html: sandboxCase("i1-meta-copy").frames[0].html,
        nonce: newSandboxNonce(),
        kitJs: "/* no kit */",
        kitCss: "/* no kit */",
      });
      if (variant !== "as built") srcdoc = srcdoc.replace("; require-trusted-types-for 'script'; trusted-types default", "");
      await page.evaluate((doc) => {
        const f = document.createElement("iframe");
        f.setAttribute("sandbox", "allow-scripts");
        f.srcdoc = doc;
        document.body.appendChild(f);
      }, srcdoc);
      await waitForProbe(run, "i1-meta-copy", "done", 5_000);
      await finishCase(run, SETTLE_MS);
      const hits = run.record.hits!;
      testInfo.annotations.push({
        type: "recorded",
        description:
          `${run.at}: metas readable ${JSON.stringify(probeValue(run.probes, "i1-meta-copy", "metaCount"))}, ` +
          `hashes copied ${JSON.stringify(probeValue(run.probes, "i1-meta-copy", "hashesFound"))}, canary saw ${summariseHits(hits)}`,
      });
      run.note("Informational: a document without the kit. A hit here shows what the kit's meta removal and Trusted Types policy stop.");
    });
  }
});

// ---------------------------------------------------------------------------
// The plan's seven, and the handshake
// ---------------------------------------------------------------------------

test("benign: the srcdoc frame still loads and runs with the parent's frame-src 'none'; port handshake, theme, data, keyboard, system fonts", async ({
  page,
  request,
  browserName,
}) => {
  const run = await startCase(page, request, browserName, "benign");
  await page.addInitScript(() => {
    localStorage.setItem("rolefit-theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  await openHarness(run, "benign");
  run.note(`Parent CSP on the harness page: ${run.record.parentCsp}`);
  expect(await waitForProbe(run, "benign", "init", 8_000), `${run.at}: init never reached the frame over the port`).toBe(true);
  expect(probeValue(run.probes, "benign", "start"), `${run.at}: the frame's origin`).toEqual({ origin: "null", nonce: true });
  const init = probeValue(run.probes, "benign", "init") as Record<string, unknown>;
  expect(init.jobs, `${run.at}: the snapshot's jobs reached the frame`).toBe(2);
  expect(init.profileName, `${run.at}: the profile name must not be in the snapshot`).toBe(false);
  expect(init.theme, `${run.at}: the theme from init`).toBe("dark");
  expect(init.attr, `${run.at}: the kit set data-theme`).toBe("dark");
  expect(String(probeValue(run.probes, "benign", "font")), `${run.at}: the kit's system font stack`).toContain("system-ui");

  // Keyboard on jb-button: Enter sends an action, which becomes a host chip; only a press runs it.
  const frame = page.frameLocator("[data-sandbox-surface] iframe").first();
  await frame.locator("jb-button#act").focus();
  await page.keyboard.press("Enter");
  const chip = page.locator("[data-sandbox-chip]");
  await expect(chip, `${run.at}: Enter on jb-button produced a chip`).toHaveText("Shortlist Senior Product Engineer at Acme Systems");
  expect(await harnessLog(page, "intents"), `${run.at}: nothing ran before the press`).toEqual([]);
  await page.waitForTimeout(ARMED_AFTER_MS);
  await chip.click();

  // Liveness: the frame keeps answering pings well past the handshake and pong deadlines.
  await finishCase(run, 4_000);
  expectNoHits(run);
  expectContained(run);
  expect(run.record.frames[0]?.present, `${run.at}: the frame is still mounted after 4 s of pings`).toBe(true);
  expect(run.record.fallbacks, `${run.at}: no fallback`).toEqual([]);
  expect(run.record.intents, `${run.at}: the press ran the stub's intent once, from the frame`).toEqual([
    { surface: expect.any(String), value: { intent: { name: "shortlist.set", jobId: HARNESS_JOB_A, state: "shortlisted" }, source: "frame" } },
  ]);
});

test("origin-storage: origin inside the frame is 'null' and localStorage, cookies and parent.document throw", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "origin-storage");
  await hostileCase(run, "origin-storage", 8_000);
  const origin = probeValue(run.probes, "origin-storage", "origin") as { ok?: boolean; r?: string } | undefined;
  expect(origin?.r, `${run.at}: self.origin`).toBe("null");
  expectThrew(run, "origin-storage", "localStorage", "localStorage did not throw");
  expectThrew(run, "origin-storage", "sessionStorage", "sessionStorage did not throw");
  expectThrew(run, "origin-storage", "cookieRead", "reading document.cookie did not throw");
  expectThrew(run, "origin-storage", "cookieWrite", "writing document.cookie did not throw");
  expectThrew(run, "origin-storage", "parentDocument", "parent.document was readable");
  expectThrew(run, "origin-storage", "topDocument", "top.document was readable");
  expectThrew(run, "origin-storage", "parentLocationRead", "parent.location.href was readable");
});

test("subresources: fetch, img, script src, font, WebSocket, sendBeacon and every other subresource to the canary are blocked", async ({
  page,
  request,
  browserName,
}) => {
  const run = await startCase(page, request, browserName, "subresources");
  await hostileCase(run, "subresources", 8_000);
});

const NAVIGATION_CASES: Array<[SandboxCaseName, string]> = [
  ["nav-parse", "location assigned while the document is parsing (I2)"],
  ["nav-oninit", "location assigned from onInit, possibly before load (I2)"],
  ["nav-after-load", "location = canary after load"],
  ["nav-meta-refresh", "meta refresh in the markup"],
  ["nav-meta-refresh-dynamic", "meta refresh inserted by script"],
  ["nav-anchor-script", "an anchor clicked by script"],
  ["nav-never-finishes", "navigation after init to a page that never finishes loading (I2)"],
];

for (const [caseName, what] of NAVIGATION_CASES) {
  test(`${caseName}: ${what} does not reach the canary, and frame.url() stays about:srcdoc or the host has blanked it`, async ({
    page,
    request,
    browserName,
  }) => {
    const run = await startCase(page, request, browserName, caseName);
    await openHarness(run, caseName);
    await page.waitForTimeout(NAV_WAIT_MS);
    await finishCase(run, 0);
    expectRan(run, caseName);
    expectNoHits(run);
    expectContained(run);
  });
}

test("nav-form: form submit, requestSubmit and a pressed submit button do not reach the canary", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "nav-form");
  await openHarness(run, "nav-form");
  await waitForProbe(run, "nav-form", "done", 5_000);
  const pressed = await page
    .frameLocator("[data-sandbox-surface] iframe")
    .first()
    .locator("#send")
    .click({ timeout: 2_000 })
    .then(() => true, () => false);
  run.note(`Real click on the submit button: ${pressed ? "made" : "not possible (the frame was gone)"}`);
  await page.waitForTimeout(NAV_WAIT_MS);
  await finishCase(run, 0);
  expectRan(run, "nav-form");
  expectNoHits(run);
  expectContained(run);
});

test("nav-anchor-user: an anchor the user clicks does not reach the canary", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "nav-anchor-user");
  await openHarness(run, "nav-anchor-user");
  await waitForProbe(run, "nav-anchor-user", "done", 5_000);
  const clicked = await page
    .frameLocator("[data-sandbox-surface] iframe")
    .first()
    .locator("#go")
    .click({ timeout: 2_000 })
    .then(() => true, () => false);
  expect(clicked, `${run.at}: the anchor could be clicked`).toBe(true);
  await page.waitForTimeout(NAV_WAIT_MS);
  await finishCase(run, 0);
  expectRan(run, "nav-anchor-user");
  expectNoHits(run);
  expectContained(run);
});

for (const caseName of ["nav-data-url", "nav-blob-url"] as const) {
  test(`${caseName}: a self-navigated page never receives init, and nothing reaches the canary`, async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, caseName);
    await openHarness(run, caseName);
    await page.waitForTimeout(NAV_WAIT_MS);
    await finishCase(run, 0);
    expectRan(run, caseName);
    run.note(
      `The navigated page ran: ${hasProbe(run.probes, caseName, "navigatedAlive")}; posted its own ready: ` +
        `${hasProbe(run.probes, caseName, "navigatedPostedReady")}`,
    );
    const gotInit = run.probes.filter(
      (p) => p.t === caseName && (p.k === "navigatedGotPortMessage" || p.k === "navigatedGotWindowMessage") && p.v === "init",
    );
    expect(gotInit, `${run.at}: the navigated page received init`).toEqual([]);
    expectNoHits(run);
    expectContained(run);
  });
}

test("window-open: window.open and top navigation are blocked", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "window-open");
  await openHarness(run, "window-open");
  const harnessUrl = page.url();
  await waitForProbe(run, "window-open", "done", 5_000);
  const clicked = await page
    .frameLocator("[data-sandbox-surface] iframe")
    .first()
    .locator("#topa")
    .click({ timeout: 2_000 })
    .then(() => true, () => false);
  run.note(`Real click on the target=_top anchor: ${clicked ? "made" : "not possible"}`);
  await finishCase(run, SETTLE_MS);
  expectRan(run, "window-open");
  const opened = probeValue(run.probes, "window-open", "open") as { ok?: boolean; r?: string } | undefined;
  expect(opened?.ok === false || opened?.r === "null", `${run.at}: window.open returned a window (${JSON.stringify(opened)})`).toBe(true);
  expectThrew(run, "window-open", "topAssign", "top.location could be assigned");
  expectThrew(run, "window-open", "parentAssign", "parent.location could be assigned");
  expectThrew(run, "window-open", "topReplace", "top.location.replace did not throw");
  expect(run.record.popups, `${run.at}: popups opened`).toEqual([]);
  expect(run.record.pageUrlAfter, `${run.at}: the top page navigated`).toBe(harnessUrl);
  expectNoHits(run);
  expectContained(run);
});

for (const caseName of ["link-hints-static", "link-hints-dynamic"] as const) {
  test(`${caseName}: a dns-prefetch, preconnect, prefetch, preload or speculation-rules hint produces no request`, async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, caseName);
    await hostileCase(run, caseName, 6_000, 3_000);
    run.note("dns-prefetch to an IP literal makes no DNS query; a DNS-only leak is not observable with this canary.");
  });
}

test("webrtc: RTCPeerConnection with STUN and TURN servers on the canary sends nothing", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "webrtc");
  await openHarness(run, "webrtc");
  await waitForProbe(run, "webrtc", "done", 8_000);
  await finishCase(run, 3_000);
  expectRan(run, "webrtc");
  run.note(
    "The STUN/TURN servers are on 127.0.0.1; some browsers do not use loopback for ICE by default, so a zero here does not " +
      "rule out a leak to a routable address.",
  );
  if (probeValue(run.probes, "webrtc", "rtc") === "unavailable") {
    test.skip(true, `[${browserName}] RTCPeerConnection is not available in this browser build, so the WebRTC case cannot run here`);
  }
  expectNoHits(run);
  expectContained(run);
});

// ---------------------------------------------------------------------------
// I1: the hash policy, the metas and Trusted Types
// ---------------------------------------------------------------------------

test("i1-meta-copy: the metas are gone before model code runs, so no nonce-and-hash script with integrity loads", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i1-meta-copy");
  await hostileCase(run, "i1-meta-copy", 6_000);
  expect(probeValue(run.probes, "i1-meta-copy", "metaCount"), `${run.at}: CSP metas still in the DOM`).toBe(0);
  expect(probeValue(run.probes, "i1-meta-copy", "hashesFound"), `${run.at}: hashes readable`).toBe(0);
});

test("i1-runtime-hash: a script hashing its own salted text and loading with nonce, integrity and src reaches nothing", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i1-runtime-hash");
  await hostileCase(run, "i1-runtime-hash", 8_000);
  const tt = probeValue(run.probes, "i1-runtime-hash", "trustedTypes") === true;
  run.note(`Trusted Types: ${tt}; crypto.subtle: ${JSON.stringify(probeValue(run.probes, "i1-runtime-hash", "haveSubtle"))}; hash computed: ${hasProbe(run.probes, "i1-runtime-hash", "hashComputed")}`);
  if (tt && hasProbe(run.probes, "i1-runtime-hash", "hashComputed")) {
    expectThrew(run, "i1-runtime-hash", "byProperty", "script.src was assignable under Trusted Types");
    expectThrew(run, "i1-runtime-hash", "byAttribute", "setAttribute('src') was allowed under Trusted Types");
    expectThrew(run, "i1-runtime-hash", "byFragment", "createContextualFragment with script markup was allowed under Trusted Types");
  }
});

test("i1-meta-removed: with both metas removed, policy 1 still blocks an image and policy 2 still blocks a nonce'd style", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i1-meta-removed");
  await hostileCase(run, "i1-meta-removed", 6_000);
  expect(probeValue(run.probes, "i1-meta-removed", "metaCount"), `${run.at}: CSP metas still in the DOM`).toBe(0);
  expect(probeValue(run.probes, "i1-meta-removed", "styleApplied"), `${run.at}: a nonce'd style applied, so policy 2 (hashes) is no longer enforced`).toBe(false);
});

test("i1-trusted-types: the default policy refuses script URLs and script text, a second policy, and frame markup", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i1-trusted-types");
  await hostileCase(run, "i1-trusted-types", 6_000);
  const tag = "i1-trusted-types";
  expect(hasProbe(run.probes, tag, "scriptTextRan"), `${run.at}: script text set from model code ran`).toBe(false);
  const tt = probeValue(run.probes, tag, "trustedTypes") === true;
  run.note(`Trusted Types available: ${tt}`);
  if (tt) {
    expectThrew(run, tag, "srcProperty", "script.src was assignable");
    expectThrew(run, tag, "srcAttribute", "setAttribute('src') on a script was allowed");
    expectThrew(run, tag, "scriptText", "script text was assignable");
    expectThrew(run, tag, "createPolicyOther", "a second Trusted Types policy could be created");
    expectThrew(run, tag, "createPolicyDefault", "a second default policy could be created");
    expectThrew(run, tag, "innerHTMLFrame", "innerHTML with frame markup was allowed");
    expectThrew(run, tag, "innerHTMLScript", "innerHTML with script markup was allowed");
  }
});

test("i1-child-realm: document.write and frame elements throw, the locks hold, and no child realm loads anything", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i1-child-realm");
  await hostileCase(run, "i1-child-realm", 6_000);
  const tag = "i1-child-realm";
  expectThrew(run, tag, "write", "document.write did not throw");
  expectThrew(run, tag, "writeln", "document.writeln did not throw");
  expectThrew(run, tag, "createIframe", "createElement('iframe') did not throw");
  expectThrew(run, tag, "createIframeNS", "createElementNS(xhtml, 'iframe') did not throw");
  expectThrew(run, tag, "createObject", "createElement('object') did not throw");
  expectThrew(run, tag, "restoreWrite", "Document.prototype.write could be redefined");
  expectThrew(run, tag, "implementationWrite", "write on a document.implementation document did not throw");
  run.note(`innerHTML frame markup: ${JSON.stringify(probeValue(run.probes, tag, "innerHTMLFrame"))}; child write: ${JSON.stringify(probeValue(run.probes, tag, "childWrite"))}`);
});

// ---------------------------------------------------------------------------
// I3, layout, and two frames
// ---------------------------------------------------------------------------

test("i3-chip-swap: a chip swapped in as the pointer leaves the frame cannot take the press aimed at the old one", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "i3-chip-swap");
  await openHarness(run, "i3-chip-swap");
  const iframe = page.locator("[data-sandbox-surface] iframe").first();
  const box = await iframe.boundingBox();
  expect(box, `${run.at}: the frame has a box`).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 40));
  const chip = page.locator("[data-sandbox-chip]");
  await expect(chip, `${run.at}: the first request's chip`).toHaveText("Shortlist Senior Product Engineer at Acme Systems", { timeout: 8_000 });
  await page.waitForTimeout(ARMED_AFTER_MS);

  // (a) Leave the frame for the armed chip and press down on it; the frame swaps the request.
  const chipBox = await chip.boundingBox();
  expect(chipBox, `${run.at}: the chip has a box`).not.toBeNull();
  const cx = chipBox!.x + Math.min(chipBox!.width / 2, 40);
  const cy = chipBox!.y + chipBox!.height / 2;
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.mouse.down();
  const compare = "Compare Senior Product Engineer at Acme Systems with Staff Backend Engineer at Globex";
  const swapped = await expect(chip)
    .toHaveText(compare, { timeout: 3_000 })
    .then(() => true, () => false);
  const swappedAt = Date.now();
  await page.mouse.up();
  expect(hasProbe(run.probes, "i3-chip-swap", "swap") || swapped, `${run.at}: the frame did not see the pointer leave, so the swap never happened`).toBe(true);
  expect(swapped, `${run.at}: the chip was not replaced after the pointer left the frame`).toBe(true);
  expect(await harnessLog(page, "intents"), `${run.at}: a press that began on the old chip ran something`).toEqual([]);

  // (b) A click right after the swap is ignored (the chip is not armed yet).
  const newBox = await chip.boundingBox();
  await page.mouse.click(newBox!.x + Math.min(newBox!.width / 2, 40), newBox!.y + newBox!.height / 2);
  const elapsed = Date.now() - swappedAt;
  if (elapsed < 600) {
    expect(await harnessLog(page, "intents"), `${run.at}: a click ${elapsed} ms after the swap ran something`).toEqual([]);
  } else {
    run.note(`Step (b) inconclusive: the click came ${elapsed} ms after the swap, too late to test the arming delay.`);
  }

  // (c) Once armed, one click runs the new request once.
  await page.waitForTimeout(ARMED_AFTER_MS);
  await chip.click();
  await finishCase(run, 500);
  expectRan(run, "i3-chip-swap");
  expect(run.record.intents, `${run.at}: the armed press ran the new request once`).toEqual([
    { surface: expect.any(String), value: { intent: { name: "compare", jobIds: [HARNESS_JOB_A, HARNESS_JOB_B] }, source: "frame" } },
  ]);
  expectNoHits(run);
  expectContained(run);
});

test("cap-1200: a 3,000px document is shown at most 1,200px tall", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "cap-1200");
  await hostileCase(run, "cap-1200", 8_000, 500);
  expect(Number(probeValue(run.probes, "cap-1200", "height")), `${run.at}: the document is taller than the cap`).toBeGreaterThanOrEqual(3_000);
  expect(run.record.frames[0]?.styleHeight, `${run.at}: the iframe's height`).toBe("1200px");
  const box = await page.locator("[data-sandbox-surface] iframe").first().boundingBox();
  expect(Math.round(box?.height ?? 0), `${run.at}: the iframe's rendered height`).toBeLessThanOrEqual(1_202);
  expect(Math.round(box?.height ?? 0), `${run.at}: the iframe's rendered height`).toBeGreaterThanOrEqual(1_198);
});

test("siblings: one frame cannot inject init into, read, or navigate another frame on the page", async ({ page, request, browserName }) => {
  const run = await startCase(page, request, browserName, "siblings");
  await openHarness(run, "siblings");
  await waitForProbe(run, "siblings-a", "done", 8_000);
  await waitForProbe(run, "siblings-b", "done", 8_000);
  await finishCase(run, SETTLE_MS);
  expectRan(run, "siblings-a");
  expectRan(run, "siblings-b");
  const frames = Number(probeValue(run.probes, "siblings-a", "frames"));
  expect(frames, `${run.at}: the first frame sees the second in parent.frames`).toBeGreaterThanOrEqual(2);
  const bInit = probeValue(run.probes, "siblings-b", "bInit") as { fake?: boolean; jobs?: number } | undefined;
  const bLater = probeValue(run.probes, "siblings-b", "bLater") as { fake?: boolean; jobs?: number } | undefined;
  expect(bInit, `${run.at}: the second frame got its own init`).toEqual({ fake: false, jobs: 2 });
  expect(bLater, `${run.at}: the second frame's host.data stayed its own`).toEqual({ fake: false, jobs: 2 });
  for (const p of run.probes.filter((x) => x.t === "siblings-a" && (x.k.startsWith("readDocument") || x.k.startsWith("navigate")))) {
    expect(threw([p], "siblings-a", p.k), `${run.at}: ${p.k} on the sibling frame did not throw (${JSON.stringify(p.v)})`).toBe(true);
  }
  expect(run.record.fallbacks, `${run.at}: neither frame fell back`).toEqual([]);
  expect(run.record.frames.map((f) => f.present), `${run.at}: both frames still mounted`).toEqual([true, true]);
  expectNoHits(run);
  expectContained(run);
});
