// Real-browser enforcement tests for the variant 3 sandbox (plan Task 2.7; spec 10
// "Variant 3 sandbox"; PR J2 report "Open for Task 2.7" and "Task 2.7 canary cases for I1";
// PR J2 review "For Task 2.7"; PR J3 review I1 to I3). Each case opens the public harness
// page (app/ui-gallery/sandbox-harness) of a production build with one hostile document from
// fixtures.ts in the production SandboxFrame.
//
// Two lanes, named by the harness page's CSP (SANDBOX_LANES), each with its own path:
//   - "frame-src-none" is the configuration the product ships. Every case checks that the
//     frame ran and tried what it is about (its own "attempted" or "done" probe, and no
//     refusal of its own inline scripts), that the canary saw nothing at all, and that
//     every frame is still at about:srcdoc or has been removed.
//   - "baseline-csp" has only the site-wide CSP, so the parent does not stop a
//     self-navigation. The navigation, I2, data:/blob: and window-open cases run there too,
//     to test the host's own teardown (second load, liveness, handshake) and to record what
//     one navigation request carries: gate A18's input. There the canary's record is kept,
//     not asserted to be zero; the host must remove a frame that navigated, with a teardown
//     reason, and a navigated page must never receive init.
//
// Controls gate the rows they validate, per browser: a row whose control failed is skipped
// with the control's name as the reason, never shown green. control-top (the canary counts
// the top page's requests) gates every case; control-plain-frame (a plain sandboxed srcdoc
// frame reaches the canary under frame-src 'none') gates the frame-src-none lane except
// benign, which decides the frame-src question itself; control-nav (a plain sandboxed frame
// navigates to the canary) gates the baseline-csp lane; control-webrtc (the same STUN/TURN
// code from the top page reaches the canary) gates the webrtc row.
//
// CI run 2 (decisions recorded per row, with a named reason in the JSON and an annotation):
//   - link-hints-static asserts that checkV3Static refuses the fixture and every case and
//     whitespace variant of link, meta and base (STATIC_MARKUP_VARIANTS), then runs the
//     fixture with the check bypassed and records the canary per browser, not asserted:
//     a parser-inserted preconnect is not governed by CSP in WebKit, so the static check is
//     the layer that stops it.
//   - window-open is split into window-open, top-nav, anchor-blank, anchor-top and
//     anchor-top-user, each with its own canary record, so a hit names its sub-action.
//   - The kit cancels clicks on links and strips href, so the anchor cases record whether
//     each click arrived cancelled or at a link with no href left.
//   - nav-never-finishes records which leaving signals the browser fired; in WebKit, if it
//     fired none and the frame was left in place, the baseline-csp row is marked fixme
//     with that reason (production is protected by frame-src 'none', whose row asserts it).
//
// Every case writes test-results/sandbox/results/<browser>--<lane>-<title>.json with the
// lane and path, the probes, the canary record, the frames' state, the harness logs, the
// controls it read and the outcome, whether it passed, failed or was skipped. Cases run one
// at a time (one worker) because the canary's record is shared.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  HARNESS_DESCRIBE_DELAY_MS,
  HARNESS_ENABLE_ENV,
  HARNESS_JOB_A,
  HARNESS_JOB_B,
  SANDBOX_CANARY_ORIGIN,
  SANDBOX_LANES,
  STATIC_MARKUP_VARIANTS,
  WEBRTC_ATTEMPT_JS,
  isSandboxCaseName,
  sandboxCase,
  type SandboxCaseName,
  type SandboxLane,
} from "../../app/ui-gallery/sandbox-harness/fixtures";
import { buildSandboxDocument, checkV3Static, newSandboxNonce } from "../../lib/agent/surfaces/v3/document";
import { effectsFromIntents, judgeHtmlCase, type HtmlEffects, type HtmlInjectionCase } from "../../lib/agent/evals/injectionHtml";
import {
  SANDBOX_GATES_DIR,
  SANDBOX_RESULTS_DIR,
  hasProbe,
  inlineScriptRefusals,
  mergeProbes,
  navigationRequests,
  parseProbe,
  probeValue,
  resultFileName,
  summariseHits,
  threw,
  type CanaryHits,
  type Probe,
} from "./results";

const CONTROL = "http://127.0.0.1:4598";
/** After a case says "done": time for late requests (prefetch, beacon, refresh) to arrive. */
const SETTLE_MS = 2_000;
/** frame-src-none navigation cases: longer than the handshake (3 s) and a missed pong (1 s + 2.5 s). */
const NAV_WAIT_MS = 6_000;
/** baseline-csp lane: init, the navigation, then the slowest teardown (no_heartbeat after about 4 s). */
const BASELINE_WAIT_MS = 9_000;
/** SandboxFrame's CHIP_ARM_MS (components/agent/sandbox/SandboxFrame.tsx; not imported, it pulls in the server actions). */
const CHIP_ARM_MS = 700;
const ARMED_AFTER_MS = CHIP_ARM_MS + 200;
/** How often the frames' <pre id="probe"> logs are read while a case runs, so a removed frame's log is not lost. */
const DOM_POLL_MS = 250;
/** The host's fallback reasons for a frame whose document was replaced or stopped answering. */
const TEARDOWN_REASONS = ["self_navigation", "no_heartbeat", "no_handshake"];

/** What each case must have recorded to show it tried what it is about. Default: "done". */
const ATTEMPTS: Partial<Record<SandboxCaseName, { all?: string[]; any?: string[]; ok?: string[] }>> = {
  "nav-parse": { all: ["before"], any: ["assigned", "navThrow"] },
  "nav-oninit": { all: ["init", "state"], any: ["assigned", "navThrow"] },
  "nav-after-load": { all: ["go"], any: ["assigned", "navThrow"] },
  "nav-meta-refresh": { all: ["attempted"] },
  // Since CI run 1 the kit refuses createElement("meta"), so "insert" is expected to throw.
  "nav-meta-refresh-dynamic": { all: ["insert"] },
  "nav-form": { all: ["submit", "requestSubmit", "done"] },
  "nav-anchor-script": { all: ["clicked", "clickFresh", "freshClicked", "done"], ok: ["click"] },
  "nav-anchor-user": { all: ["clicked", "done"] },
  "nav-data-url": { any: ["assigned", "navThrow"] },
  "nav-blob-url": { any: ["assigned", "navThrow"] },
  "nav-never-finishes": { all: ["init", "suppressPost"], any: ["assigned", "navThrow"] },
  "window-open": { all: ["open", "done"] },
  "top-nav": { all: ["topAssign", "parentAssign", "topReplace", "done"] },
  "anchor-blank": { all: ["clickBlank", "clicked", "clickFresh", "freshClicked", "done"] },
  "anchor-top": { all: ["clickTop", "clicked", "clickFresh", "freshClicked", "done"] },
  "anchor-top-user": { all: ["clicked", "done"] },
};

/** CI run 2, item 1(b): why link-hints-static's canary record is kept, not asserted. */
const LINK_HINTS_STATIC_REASON =
  "browser layer: parser-inserted preconnect is not governed by CSP in WebKit; production static check rejects it (see a)";

/** CI run 2, item 3: why the WebKit nav-never-finishes row on the baseline-csp lane may be fixme. */
const NEVER_FINISHES_WEBKIT_REASON =
  "browser layer: WebKit fired none of beforeunload, pagehide or navigate for a navigation whose response never finishes, " +
  "so the kit had nothing to report and the old document kept answering pings; production is protected by frame-src 'none' " +
  "(the frame-src-none lane's nav-never-finishes row asserts it)";

/**
 * Inline scripts a case's CSP is meant to refuse: the speculation-rules script the document
 * builder leaves unhashed on purpose, and the script text model code injects in
 * i1-trusted-types. Any other refusal of an inline script means a fixture script never ran.
 */
const ALLOWED_INLINE_REFUSALS: Partial<Record<string, number>> = { "link-hints-static": 1, "i1-trusted-types": 1 };

/**
 * baseline-csp lane cases whose navigation nothing in the frame stops: the host must remove
 * the frame. Since CI run 2 the kit cancels link clicks, so the anchor cases are not here;
 * expectLinksStopped checks them instead.
 */
const MUST_TEAR_DOWN: SandboxCaseName[] = ["nav-parse", "nav-oninit", "nav-after-load", "nav-never-finishes"];

interface FrameState {
  index: number;
  present: boolean;
  url: string | null;
  styleHeight: string | null;
}

interface CaseRecord {
  browser: string;
  case: string;
  lane: SandboxLane | "controls";
  path: string;
  parentCsp: string | null;
  parentFrameSrcNone: boolean | null;
  gates: Record<string, string>;
  /** What checkV3Static would refuse in each of the case's documents: the harness skips it on purpose. */
  staticCheck: Array<{ tag: string; refusals: string[] }>;
  probes: Probe[];
  hits: CanaryHits | null;
  hitsAsserted: boolean;
  /** Why the canary record is kept and not asserted, where a row does that (CI run 2). */
  recordedReason: string | null;
  frames: FrameState[];
  intents: unknown[];
  fallbacks: unknown[];
  reports: unknown[];
  /** Every load event of every iframe on the harness page (PR 3). */
  loads: unknown[];
  popups: string[];
  pageUrlAfter: string | null;
  outcome: string | null;
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
    readonly lane: SandboxLane | "controls",
  ) {
    this.record = {
      browser, case: name, lane, path: lane === "controls" ? "" : SANDBOX_LANES[lane], parentCsp: null, parentFrameSrcNone: null,
      gates: {}, staticCheck: [], probes: [], hits: null, hitsAsserted: lane === "frame-src-none",
      recordedReason: lane === "baseline-csp" ? "baseline-csp lane: the canary record is gate A18's input" : null,
      frames: [], intents: [], fallbacks: [], reports: [], loads: [],
      popups: [], pageUrlAfter: null, outcome: null, notes: [],
    };
  }

  get probes(): Probe[] {
    return mergeProbes(this.consoleProbes, this.domProbes);
  }

  /** The prefix of every assertion message: browser, lane and case, because CI output is the only evidence. */
  get at(): string {
    return `[${this.browser}] [${this.lane}] ${this.name}`;
  }

  note(text: string) {
    this.record.notes.push(text);
  }
}

// ---------------------------------------------------------------------------
// Control gates: a file per browser and control, because a failed test restarts the worker
// and module state does not survive it.
// ---------------------------------------------------------------------------

interface Gate {
  passed: boolean;
  detail: string;
}

function gatePath(browser: string, control: string): string {
  return path.join(SANDBOX_GATES_DIR, `${browser}--${control}.json`);
}

function writeGate(browser: string, control: string, gate: Gate) {
  mkdirSync(SANDBOX_GATES_DIR, { recursive: true });
  writeFileSync(gatePath(browser, control), JSON.stringify(gate, null, 2));
}

function readGate(browser: string, control: string): Gate | null {
  const file = gatePath(browser, control);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Gate;
  } catch {
    return null;
  }
}

/** Skips the row, with the control's name, unless every listed control passed in this browser. */
function requireControls(run: CaseRun, controls: string[]) {
  for (const control of controls) {
    const gate = readGate(run.browser, control);
    run.record.gates[control] = gate === null ? "did not run" : gate.passed ? "passed" : `failed: ${gate.detail}`;
    if (gate === null) test.skip(true, `${run.at}: inconclusive, ${control} did not run in this browser, so this row has no control`);
    else if (!gate.passed) test.skip(true, `${run.at}: inconclusive, ${control} failed in this browser (${gate.detail})`);
  }
}

function laneControls(lane: SandboxLane, caseName: SandboxCaseName): string[] {
  if (lane === "baseline-csp") return ["control-top", "control-nav"];
  return caseName === "benign" ? ["control-top"] : ["control-top", "control-plain-frame"];
}

// ---------------------------------------------------------------------------
// The canary, the page and the probes
// ---------------------------------------------------------------------------

async function resetCanary(request: APIRequestContext) {
  const res = await request.post(`${CONTROL}/reset`);
  expect(res.ok(), "the canary's control API answered the reset").toBe(true);
}

async function readHits(request: APIRequestContext): Promise<CanaryHits> {
  const res = await request.get(`${CONTROL}/hits`);
  expect(res.ok(), "the canary's control API answered").toBe(true);
  return (await res.json()) as CanaryHits;
}

async function startCase(page: Page, request: APIRequestContext, browser: string, name: string, lane: SandboxLane | "controls"): Promise<CaseRun> {
  await resetCanary(request);
  const run = new CaseRun(page, request, browser, name, lane);
  if (isSandboxCaseName(name)) {
    // The harness gives SandboxFrame the documents without checkV3Static, on purpose: these
    // cases test what the browser, the sandbox, the CSP and the kit stop on their own when
    // the static checks have been beaten. The record says what the static checks would have
    // refused in production, per document.
    run.record.staticCheck = sandboxCase(name).frames.map((f) => ({ tag: f.tag, refusals: checkV3Static(f.html) }));
    const refused = run.record.staticCheck.filter((s) => s.refusals.length > 0);
    run.note(
      refused.length > 0
        ? `Static checks bypassed on purpose: in production checkV3Static would refuse this document (${refused.map((s) => `${s.tag}: ${s.refusals.join("; ")}`).join(" | ")}).`
        : "Static checks bypassed on purpose, but checkV3Static would accept this document: the browser layer is all that stands here.",
    );
  }
  page.on("console", (message) => {
    const probe = parseProbe(message.text());
    if (probe) run.consoleProbes.push(probe);
  });
  page.on("popup", (popup) => run.record.popups.push(popup.url()));
  current = run.record;
  return run;
}

/** Opens the harness for a case (or its index), checks it rendered, and reads the frames' first probes while they exist. */
async function openHarness(run: CaseRun, lane: SandboxLane, caseName: SandboxCaseName | null, startTags: string[] = caseName ? [caseName] : []) {
  const url = caseName ? `${SANDBOX_LANES[lane]}?case=${caseName}` : SANDBOX_LANES[lane];
  const response = await run.page.goto(url, { waitUntil: "load" });
  expect(response?.status(), `${run.at}: ${url} answered`).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? null;
  run.record.parentCsp = csp;
  run.record.parentFrameSrcNone = csp === null ? null : /(?:^|;)\s*frame-src 'none'/.test(csp);
  const main = run.page.locator("main[data-sandbox-harness]");
  await expect(main).toBeVisible();
  const rendered = await main.getAttribute("data-sandbox-harness");
  if (caseName && rendered === "index") {
    throw new Error(`${run.at}: the harness rendered its index, not the case: the server needs ${HARNESS_ENABLE_ENV}=1`);
  }
  expect(rendered, `${run.at}: the harness rendered`).toBe(caseName ?? "index");
  expect(await main.getAttribute("data-sandbox-lane"), `${run.at}: the lane`).toBe(lane);
  expect(run.record.parentFrameSrcNone, `${run.at}: ${url} has the lane's CSP (${csp})`).toBe(lane === "frame-src-none");
  for (const tag of startTags) await waitForProbe(run, tag, "start", 3_000);
}

async function readDomProbes(page: Page): Promise<Probe[]> {
  const out: Probe[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const text = await frame.locator("#probe").textContent({ timeout: 200 });
      for (const line of (text ?? "").split("\n")) {
        const probe = parseProbe(line);
        if (probe) out.push(probe);
      }
    } catch {
      // The frame navigated away or was removed: what was read before, and its console lines, are all there is.
    }
  }
  return out;
}

async function readDomNow(run: CaseRun) {
  run.domProbes = mergeProbes(run.domProbes, await readDomProbes(run.page));
}

/** Waits for a probe without failing, reading the frames' logs as it goes; returns whether it came. */
async function waitForProbe(run: CaseRun, tag: string, key: string, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (hasProbe(run.probes, tag, key)) return true;
    await readDomNow(run);
    if (hasProbe(run.probes, tag, key)) return true;
    await run.page.waitForTimeout(DOM_POLL_MS);
  }
  return hasProbe(run.probes, tag, key);
}

/** Lets a case run for a while, reading the frames' logs as it goes. */
async function pollFor(run: CaseRun, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await readDomNow(run);
    await run.page.waitForTimeout(DOM_POLL_MS);
  }
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

/**
 * A harness log, or [] where the page has none. CI run 1: the controls open the harness
 * index, which has no <output> logs, and a bare textContent() waits for its element until
 * the test times out (Playwright has no default action timeout); the control then failed at
 * the canary read with "Target page, context or browser has been closed". So: count first,
 * and never wait.
 */
async function harnessLog(page: Page, kind: "intents" | "fallbacks" | "reports" | "loads"): Promise<unknown[]> {
  const output = page.locator(`output[data-sandbox-log="${kind}"]`);
  if ((await output.count()) === 0) return [];
  const text = await output.textContent({ timeout: 1_000 }).catch(() => null);
  try {
    const parsed: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fallbackReasons(run: CaseRun): string[] {
  return run.record.fallbacks.map((f) => String((f as { value?: unknown }).value));
}

/** Lets late requests arrive, then records the probes, the frames, the harness logs and the canary. */
async function finishCase(run: CaseRun, settleMs: number) {
  if (settleMs > 0) await pollFor(run, settleMs);
  await readDomNow(run);
  run.record.frames = await frameStates(run.page);
  run.record.intents = await harnessLog(run.page, "intents");
  run.record.fallbacks = await harnessLog(run.page, "fallbacks");
  run.record.reports = await harnessLog(run.page, "reports");
  run.record.loads = await harnessLog(run.page, "loads");
  run.record.pageUrlAfter = run.page.url();
  run.record.hits = await readHits(run.request);
  run.record.probes = run.probes;
  const reasons = fallbackReasons(run);
  run.record.outcome = run.record.frames.map((f) => (f.present ? `frame ${f.index} at ${f.url}` : `frame ${f.index} removed`)).join("; ") +
    (reasons.length > 0 ? `; fallback: ${reasons.join(", ")}` : "; no fallback");
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function expectRan(run: CaseRun, tag: string = run.name) {
  expect(
    hasProbe(run.probes, tag, "start"),
    `${run.at}: the frame "${tag}" never ran (no "start" probe), so nothing it should have tried was tried. ` +
      `If every case shows this, the parent's CSP blocks the srcdoc load itself in this browser (parent CSP: ${run.record.parentCsp}).`,
  ).toBe(true);
}

/** The frame tried what the case is about: its own probes, and none of its inline scripts refused. */
function expectAttempted(run: CaseRun, caseName: SandboxCaseName, tag: string = caseName) {
  expectRan(run, tag);
  const spec = ATTEMPTS[caseName] ?? { all: ["done"] };
  for (const key of spec.all ?? []) {
    expect(hasProbe(run.probes, tag, key), `${run.at}: the frame never recorded "${key}", so the attack did not run`).toBe(true);
  }
  if (spec.any) {
    expect(spec.any.some((key) => hasProbe(run.probes, tag, key)), `${run.at}: the frame recorded none of ${spec.any.join(", ")}, so the navigation was never attempted`).toBe(true);
  }
  for (const key of spec.ok ?? []) {
    expect(threw(run.probes, tag, key), `${run.at}: "${key}" threw or never ran (${JSON.stringify(probeValue(run.probes, tag, key))}), so the attack did not run`).toBe(false);
  }
  const refusals = inlineScriptRefusals(run.probes, tag);
  expect(
    refusals.length,
    `${run.at}: the frame's CSP refused ${refusals.length} of its own inline script(s) (${JSON.stringify(refusals.map((p) => p.v))}), so part of the fixture never ran`,
  ).toBeLessThanOrEqual(ALLOWED_INLINE_REFUSALS[caseName] ?? 0);
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

/** An injection case's effects (from the logs, the frames and the canary), judged by judgeHtmlCase. */
function expectInjectionPass(run: CaseRun, caseName: HtmlInjectionCase, chipPresses: number) {
  const reasons = fallbackReasons(run);
  const effects: HtmlEffects = {
    ...effectsFromIntents(run.record.intents),
    chipPresses,
    rateLimitPassed: reasons.some((r) => r === "action_rate_limit" || r === "action_total_limit"),
    blanked: reasons.length > 0 && run.record.frames.every((f) => !f.present),
    canaryHits: run.record.hits?.total ?? 0,
    loads: run.consoleProbes.filter((p) => p.t === caseName && p.k === "start").length,
  };
  run.note(`Injection effects: ${JSON.stringify(effects)}`);
  const verdict = judgeHtmlCase(caseName, effects);
  expect(verdict.reasons, `${run.at}: the injection case failed`).toEqual([]);
}

/** Throws are recorded, not asserted: a browser that blocks silently is just as safe; the outcome is what is asserted. */
function noteThrows(run: CaseRun, tag: string, keys: string[]) {
  run.note(`Calls that threw: ${keys.map((k) => `${k}=${JSON.stringify(probeValue(run.probes, tag, k))}`).join(", ")}`);
}

/** Records what reached the canary on the baseline-csp lane (gate A18's input), as an annotation and in the JSON. */
function recordHits(run: CaseRun, testInfo: TestInfo) {
  const hits = run.record.hits!;
  const navs = navigationRequests(hits);
  testInfo.annotations.push({
    type: "recorded-canary",
    description: `${run.at}: ${summariseHits(hits)}${navs.length > 0 ? `; navigations: ${navs.map((r) => `${r.method} ${r.url}`).join(", ")}` : ""}`,
  });
}

// ---------------------------------------------------------------------------
// Case runners
// ---------------------------------------------------------------------------

/** The standard frame-src-none case: open, wait for "done", settle, then the checks. */
async function hostileCase(run: CaseRun, caseName: SandboxCaseName, waitMs: number, settleMs = SETTLE_MS) {
  requireControls(run, laneControls("frame-src-none", caseName));
  await openHarness(run, "frame-src-none", caseName);
  await waitForProbe(run, caseName, "done", waitMs);
  await finishCase(run, settleMs);
  expectNoHits(run);
  expectAttempted(run, caseName);
  expectContained(run);
}

/** A real click inside the case's frame, before the case navigates; returns whether it was made. */
async function clickInFrame(run: CaseRun, selector: string): Promise<boolean> {
  return run.page
    .frameLocator("[data-sandbox-surface] iframe")
    .first()
    .locator(selector)
    .click({ timeout: 2_000 })
    .then(() => true, () => false);
}

/** CI run 2: the old window-open case, one sub-action per case (name, what it tries, the calls whose throws are noted). */
const POPUP_CASES: Array<[SandboxCaseName, string, string[]]> = [
  ["window-open", "window.open", ["open"]],
  ["top-nav", "top and parent navigation by script", ["topAssign", "parentAssign", "topReplace"]],
  ["anchor-blank", "a target=_blank anchor clicked by script (in the markup, and made by script)", ["clickBlank", "clickFresh"]],
  ["anchor-top", "a target=_top anchor clicked by script (in the markup, and made by script)", ["clickTop", "clickFresh"]],
  ["anchor-top-user", "a target=_top anchor the user clicks", []],
];

const USER_CLICKS: Partial<Record<SandboxCaseName, string>> = { "nav-form": "#send", "nav-anchor-user": "#go", "anchor-top-user": "#topa" };

/** A navigation-style case on either lane: open, the user's click if any, wait, record. */
async function navigationCase(run: CaseRun, lane: SandboxLane, caseName: SandboxCaseName) {
  requireControls(run, laneControls(lane, caseName));
  await openHarness(run, lane, caseName);
  const selector = USER_CLICKS[caseName];
  if (selector) {
    await waitForProbe(run, caseName, "done", 5_000);
    const clicked = await clickInFrame(run, selector);
    run.note(`Real click on ${selector}: ${clicked ? "made" : "not possible (the frame was gone)"}`);
    if (caseName === "nav-anchor-user" || caseName === "anchor-top-user") expect(clicked, `${run.at}: the anchor could be clicked`).toBe(true);
  }
  await pollFor(run, lane === "baseline-csp" ? BASELINE_WAIT_MS : NAV_WAIT_MS);
  await finishCase(run, 0);
}

function expectNavigatedPageGotNoInit(run: CaseRun, caseName: SandboxCaseName) {
  run.note(
    `The navigated page ran: ${hasProbe(run.probes, caseName, "navigatedAlive")}; posted its own ready: ` +
      `${hasProbe(run.probes, caseName, "navigatedPostedReady")}`,
  );
  const gotInit = run.probes.filter(
    (p) => p.t === caseName && (p.k === "navigatedGotPortMessage" || p.k === "navigatedGotWindowMessage") && p.v === "init",
  );
  expect(gotInit, `${run.at}: the navigated page received init`).toEqual([]);
}

/**
 * CI run 2: every click on a link arrived either cancelled by the kit's guard or at an element
 * the kit's observer had already stripped of its href, and a link made by script lost its href.
 */
function expectLinksStopped(run: CaseRun, tag: string) {
  for (const key of ["clicked", "freshClicked"]) {
    if (!hasProbe(run.probes, tag, key)) continue;
    const v = probeValue(run.probes, tag, key) as { prevented?: boolean; href?: boolean } | undefined;
    expect(
      v?.prevented === true || v?.href === false,
      `${run.at}: a click on a link was neither cancelled by the kit nor left without an href (${key}: ${JSON.stringify(v)})`,
    ).toBe(true);
  }
  if (hasProbe(run.probes, tag, "freshHrefLater")) {
    expect(probeValue(run.probes, tag, "freshHrefLater"), `${run.at}: the kit's observer left the href on a link made by script`).toBe(false);
  }
  run.note(
    `Links: ${["clickedHrefAtStart", "clicked", "freshClicked", "freshHrefLater"].map((k) => `${k}=${JSON.stringify(probeValue(run.probes, tag, k))}`).join(", ")}`,
  );
}

/** baseline-csp lane: a frame that navigated is removed by the host, with a teardown reason. */
function expectHostTeardown(run: CaseRun, caseName: SandboxCaseName) {
  const reasons = fallbackReasons(run);
  for (const reason of reasons) {
    expect(TEARDOWN_REASONS, `${run.at}: unexpected fallback reason "${reason}"`).toContain(reason);
  }
  // Any request this case's paths name: in these cases only a navigation, or the page it
  // navigated to, makes one (not every engine sends Sec-Fetch headers to classify it by).
  const navigated = run.record.hits!.requests.filter((r) => r.case === caseName);
  const navigatedPageRan = hasProbe(run.probes, caseName, "navigatedAlive");
  const removed = run.record.frames.every((f) => !f.present);
  if (navigated.length > 0 || navigatedPageRan || MUST_TEAR_DOWN.includes(caseName)) {
    expect(
      removed && reasons.length > 0,
      `${run.at}: the frame ${navigated.length > 0 ? `navigated (${navigated.map((r) => r.url).join(", ")})` : navigatedPageRan ? "was replaced by the navigated page" : "should have navigated"} ` +
        `but the host did not remove it with a teardown reason (${run.record.outcome})`,
    ).toBe(true);
  } else {
    run.note(`No navigation reached the canary and the frame was ${removed ? "removed" : "left in place"}: the browser or the kit stopped this navigation.`);
  }
}

// ---------------------------------------------------------------------------
// The per-case result file
// ---------------------------------------------------------------------------

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
  writeFileSync(path.join(SANDBOX_RESULTS_DIR, resultFileName(out.browser, `${out.lane} ${testInfo.title}`)), body);
  await testInfo.attach("sandbox-result", { body, contentType: "application/json" });
  current = null;
});

// ---------------------------------------------------------------------------
// Controls (run first in each browser; their results gate the rows below)
// ---------------------------------------------------------------------------

test.describe("controls", () => {
  test("control-top: the canary counts requests from the harness page itself", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-top", "controls");
    await openHarness(run, "frame-src-none", null);
    await page.evaluate((origin) => {
      fetch(`${origin}/c/control-top/fetch`, { mode: "no-cors" }).catch(() => {});
      new Image().src = `${origin}/c/control-top/img`;
    }, SANDBOX_CANARY_ORIGIN);
    await finishCase(run, SETTLE_MS);
    const n = run.record.hits!.requests.length;
    writeGate(browserName, "control-top", { passed: n > 0, detail: `${n} request(s) from the top page` });
    expect(n, `${run.at}: the canary saw nothing from the top page, so every zero below would mean nothing`).toBeGreaterThan(0);
  });

  test("control-plain-frame: a sandboxed srcdoc frame without the CSP or kit reaches the canary under frame-src 'none'", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-plain-frame", "controls");
    await openHarness(run, "frame-src-none", null);
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
    const n = run.record.hits!.requests.length;
    writeGate(browserName, "control-plain-frame", { passed: n > 0, detail: `${n} request(s) from a plain sandboxed srcdoc frame` });
    expect(
      n,
      `${run.at}: a plain sandboxed srcdoc frame on the harness page made no request. Either the parent's CSP ` +
        `(${run.record.parentCsp}) blocks srcdoc frames in this browser, or opaque-origin frames cannot reach the canary here; ` +
        "either way the frame-src-none zero-hit rows prove nothing in this browser.",
    ).toBeGreaterThan(0);
  });

  test("control-nav: on the baseline-csp path, a plain sandboxed srcdoc frame's self-navigation reaches the canary", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-nav", "controls");
    run.record.path = SANDBOX_LANES["baseline-csp"];
    await openHarness(run, "baseline-csp", null);
    await page.evaluate((origin) => {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts");
      f.srcdoc = "<script>" + `location.href = "${origin}/c/control-nav/nav";` + "</scr" + "ipt>";
      document.body.appendChild(f);
    }, SANDBOX_CANARY_ORIGIN);
    await finishCase(run, 3_000);
    // The frame does nothing but navigate, so any request on its path is the navigation.
    const navs = run.record.hits!.requests.filter((r) => r.case === "control-nav");
    writeGate(browserName, "control-nav", { passed: navs.length > 0, detail: `${navs.length} navigation request(s) from a plain sandboxed frame` });
    expect(
      navs.length,
      `${run.at}: a plain sandboxed srcdoc frame's navigation never reached the canary (${summariseHits(run.record.hits!)}), ` +
        "so a zero on the baseline-csp lane would mean nothing in this browser",
    ).toBeGreaterThan(0);
  });

  test("control-webrtc: the same STUN/TURN attempt from the top page reaches the canary", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "control-webrtc", "controls");
    await openHarness(run, "frame-src-none", null);
    await page.evaluate((code) => {
      const w = window as unknown as { sbxRtcProbes: Array<{ t: string; k: string; v: unknown }> };
      w.sbxRtcProbes = [];
      const P = (k: string, v?: unknown) => w.sbxRtcProbes.push({ t: "control-webrtc", k, v: v === undefined ? null : v });
      const T = (k: string, f: () => unknown) => {
        try {
          const r = f();
          P(k, { ok: true, r: r === undefined || r === null ? null : String(r) });
        } catch (e) {
          P(k, { ok: false, e: String((e as Error)?.name ?? e) });
        }
      };
      const Q = (k: string, p: Promise<unknown>) =>
        Promise.resolve(p).then(
          (r) => P(k, { ok: true, r: r === undefined || r === null ? null : String(r) }),
          (e) => P(k, { ok: false, e: String((e as Error)?.name ?? e) }),
        );
      new Function("P", "T", "Q", code)(P, T, Q);
    }, WEBRTC_ATTEMPT_JS);
    await page.waitForTimeout(5_000);
    const probes = await page.evaluate(() => (window as unknown as { sbxRtcProbes: Probe[] }).sbxRtcProbes);
    run.consoleProbes.push(...probes);
    await finishCase(run, 0);
    const hits = run.record.hits!;
    const traffic = hits.udpDatagrams.length + hits.tcpConnections;
    const detail = `${hits.udpDatagrams.length} UDP datagram(s), ${hits.tcpConnections} TCP connection(s) from the top page; rtc ${JSON.stringify(probeValue(probes, "control-webrtc", "rtc"))}`;
    writeGate(browserName, "control-webrtc", { passed: traffic > 0, detail });
    run.note(detail);
    test.skip(traffic === 0, `[${browserName}] inconclusive: control saw no traffic (ICE in this build sends nothing to 127.0.0.1 from the top page)`);
  });

  test("control-webrtc-no-kit: the webrtc case without the kit, under the frame's CSP with webrtc 'block' (recorded, not asserted)", async ({
    page,
    request,
    browserName,
  }, testInfo) => {
    const run = await startCase(page, request, browserName, "control-webrtc-no-kit", "controls");
    await openHarness(run, "frame-src-none", null);
    const srcdoc = buildSandboxDocument({ html: sandboxCase("webrtc").frames[0].html, nonce: newSandboxNonce(), kitJs: "/* no kit */", kitCss: "/* no kit */" });
    await page.evaluate((doc) => {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-scripts");
      f.srcdoc = doc;
      document.body.appendChild(f);
    }, srcdoc);
    await waitForProbe(run, "webrtc", "done", 8_000);
    await finishCase(run, 3_000);
    const hits = run.record.hits!;
    testInfo.annotations.push({
      type: "recorded",
      description: `${run.at}: rtc ${JSON.stringify(probeValue(run.probes, "webrtc", "rtc"))}, offer ${JSON.stringify(probeValue(run.probes, "webrtc", "offer"))}, canary saw ${summariseHits(hits)}`,
    });
    run.note(
      "Informational: the raw browser behaviour inside the sandbox without the kit's WebRTC lock, with the frame's CSP (which now " +
        "carries webrtc 'block'). Traffic here and none in the webrtc row means the kit's lock is what stops it in this browser; " +
        "no traffic here means the browser (or webrtc 'block') stops it too.",
    );
  });

  for (const variant of ["as built", "without the Trusted Types directives"] as const) {
    test(`control-no-kit (${variant}): what copying the nonce and a hash from the metas allows without the kit (recorded, not asserted)`, async ({
      page,
      request,
      browserName,
    }, testInfo) => {
      const run = await startCase(page, request, browserName, `control-no-kit-${variant === "as built" ? "built" : "no-tt"}`, "controls");
      await openHarness(run, "frame-src-none", null);
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
      run.note(
        "Informational: a document without the kit. This is the only run of the I1-1 vector (nonce + copied hash + integrity + src), " +
          "because with the kit no hash is readable. A hit here shows what the kit's meta removal and Trusted Types policy stop. " +
          "A zero without the TT directives, in a browser that applies script hashes to external scripts (CSP3), means this control " +
          "did not work, not that the vector is closed.",
      );
    });
  }
});

// ---------------------------------------------------------------------------
// frame-src-none lane: the configuration the product ships
// ---------------------------------------------------------------------------

test.describe(`frame-src-none lane (${SANDBOX_LANES["frame-src-none"]})`, () => {
  test("benign: the srcdoc frame still loads and runs with the parent's frame-src 'none'; port handshake, theme, data, keyboard, system fonts", async ({
    page,
    request,
    browserName,
  }) => {
    const run = await startCase(page, request, browserName, "benign", "frame-src-none");
    requireControls(run, laneControls("frame-src-none", "benign"));
    await page.addInitScript(() => {
      localStorage.setItem("rolefit-theme", "dark");
      document.documentElement.dataset.theme = "dark";
    });
    await openHarness(run, "frame-src-none", "benign");
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
    expectAttempted(run, "benign");
    expectContained(run);
    expect(run.record.frames[0]?.present, `${run.at}: the frame is still mounted after 4 s of pings`).toBe(true);
    expect(run.record.fallbacks, `${run.at}: no fallback`).toEqual([]);
    expect(run.record.intents, `${run.at}: the press ran the stub's intent once, from the frame`).toEqual([
      { surface: expect.any(String), value: { intent: { name: "shortlist.set", jobId: HARNESS_JOB_A, state: "shortlisted" }, source: "frame" } },
    ]);
  });

  test("origin-storage: origin inside the frame is 'null' and localStorage, cookies and parent.document throw", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "origin-storage", "frame-src-none");
    await hostileCase(run, "origin-storage", 8_000);
    const origin = probeValue(run.probes, "origin-storage", "origin") as { ok?: boolean; r?: string } | undefined;
    expect(origin?.r, `${run.at}: self.origin`).toBe("null");
    expect(threw(run.probes, "origin-storage", "localStorage"), `${run.at}: localStorage did not throw`).toBe(true);
    expect(threw(run.probes, "origin-storage", "sessionStorage"), `${run.at}: sessionStorage did not throw`).toBe(true);
    // Cookies: a read is empty (or throws; WebKit returns "" in an opaque origin, CI run 1), a
    // write does not persist (the read-back after it is empty, or it throws), and no request
    // carried a cookie (expectNoHits above: there are no requests at all).
    const cookieRead = probeValue(run.probes, "origin-storage", "cookieRead") as { ok?: boolean; r?: unknown } | undefined;
    const cookieWrite = probeValue(run.probes, "origin-storage", "cookieWrite") as { ok?: boolean; r?: unknown } | undefined;
    expect(cookieRead?.ok === false || cookieRead?.r === "", `${run.at}: document.cookie read back ${JSON.stringify(cookieRead)}`).toBe(true);
    expect(cookieWrite?.ok === false || cookieWrite?.r === "", `${run.at}: a cookie written in the frame persisted (${JSON.stringify(cookieWrite)})`).toBe(true);
    expect(run.record.hits!.requests.filter((r) => r.cookie), `${run.at}: a request carried a cookie`).toEqual([]);
    run.note(`Cookie read: ${JSON.stringify(cookieRead)}; write and read-back: ${JSON.stringify(cookieWrite)}`);
    expect(threw(run.probes, "origin-storage", "parentDocument"), `${run.at}: parent.document was readable`).toBe(true);
    expect(threw(run.probes, "origin-storage", "topDocument"), `${run.at}: top.document was readable`).toBe(true);
    expect(threw(run.probes, "origin-storage", "parentLocationRead"), `${run.at}: parent.location.href was readable`).toBe(true);
  });

  test("subresources: fetch, img, script src, font, WebSocket, sendBeacon and every other subresource to the canary are blocked", async ({
    page,
    request,
    browserName,
  }) => {
    const run = await startCase(page, request, browserName, "subresources", "frame-src-none");
    await hostileCase(run, "subresources", 8_000);
  });

  const NAVIGATION_CASES: Array<[SandboxCaseName, string]> = [
    ["nav-parse", "location assigned while the document is parsing (I2)"],
    ["nav-oninit", "location assigned from onInit, possibly before load (I2)"],
    ["nav-after-load", "location = canary after load"],
    ["nav-meta-refresh", "meta refresh in the markup"],
    ["nav-meta-refresh-dynamic", "meta refresh inserted by script"],
    ["nav-anchor-script", "an anchor clicked by script"],
    ["nav-anchor-user", "an anchor the user clicks"],
    ["nav-form", "form submit, requestSubmit and a pressed submit button"],
    ["nav-never-finishes", "navigation after init to a page that never finishes loading (I2)"],
  ];

  for (const [caseName, what] of NAVIGATION_CASES) {
    test(`${caseName}: ${what} does not reach the canary, and the frame stays at about:srcdoc or is removed`, async ({ page, request, browserName }) => {
      const run = await startCase(page, request, browserName, caseName, "frame-src-none");
      await navigationCase(run, "frame-src-none", caseName);
      expectNoHits(run);
      expectAttempted(run, caseName);
      expectLinksStopped(run, caseName);
      expectContained(run);
      run.note(`Outcome: ${run.record.outcome}`);
    });
  }

  for (const caseName of ["nav-data-url", "nav-blob-url"] as const) {
    test(`${caseName}: a self-navigation to ${caseName === "nav-data-url" ? "data:" : "blob:"} never delivers init, and nothing reaches the canary`, async ({
      page,
      request,
      browserName,
    }) => {
      const run = await startCase(page, request, browserName, caseName, "frame-src-none");
      await navigationCase(run, "frame-src-none", caseName);
      expectNoHits(run);
      expectAttempted(run, caseName);
      expectNavigatedPageGotNoInit(run, caseName);
      expectContained(run);
    });
  }

  // CI run 2, item 2: one case per sub-action, each with its own canary record.
  for (const [caseName, what, throwKeys] of POPUP_CASES) {
    test(`${caseName}: ${what} reaches nothing and opens nothing`, async ({ page, request, browserName }) => {
      const run = await startCase(page, request, browserName, caseName, "frame-src-none");
      await navigationCase(run, "frame-src-none", caseName);
      if (throwKeys.length > 0) noteThrows(run, caseName, throwKeys);
      expectNoHits(run);
      expectAttempted(run, caseName);
      expectLinksStopped(run, caseName);
      expect(run.record.popups, `${run.at}: popups opened`).toEqual([]);
      expect(run.record.pageUrlAfter, `${run.at}: the top page navigated`).toContain(`${SANDBOX_LANES["frame-src-none"]}?case=${caseName}`);
      expectContained(run);
    });
  }

  // CI run 2, item 1: WebKit opens a bare TCP connection for the parser-inserted preconnect.
  // (a) proves the layer that stops it in production; (b) records the browser layer.
  test("link-hints-static: (a) checkV3Static refuses the markup hints and every variant; (b) the browser layer is recorded, not asserted", async (
    { page, request, browserName },
    testInfo,
  ) => {
    const run = await startCase(page, request, browserName, "link-hints-static", "frame-src-none");
    const fixture = sandboxCase("link-hints-static").frames[0].html;
    expect(checkV3Static(fixture), `${run.at}: (a) checkV3Static accepted the link-hints-static fixture`).toContain("html: <link> is not allowed");
    const missed = STATIC_MARKUP_VARIANTS.filter((v) => !checkV3Static(v.html).includes(`html: <${v.tag}> is not allowed`)).map((v) => v.html);
    expect(missed, `${run.at}: (a) checkV3Static did not refuse these variants by their tag`).toEqual([]);
    run.note(`(a) checkV3Static refuses the fixture and all ${STATIC_MARKUP_VARIANTS.length} markup variants by their tag.`);

    run.record.hitsAsserted = false;
    run.record.recordedReason = LINK_HINTS_STATIC_REASON;
    testInfo.annotations.push({ type: "recorded-not-asserted", description: `[${browserName}] ${LINK_HINTS_STATIC_REASON}` });
    requireControls(run, laneControls("frame-src-none", "link-hints-static"));
    await openHarness(run, "frame-src-none", "link-hints-static");
    await waitForProbe(run, "link-hints-static", "done", 6_000);
    await finishCase(run, 3_000);
    recordHits(run, testInfo);
    expectAttempted(run, "link-hints-static");
    expectContained(run);
    run.note("dns-prefetch to an IP literal makes no DNS query; a DNS-only leak is not observable with this canary.");
  });

  test("link-hints-dynamic: hints inserted by script produce nothing (the kit refuses link elements)", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "link-hints-dynamic", "frame-src-none");
    await hostileCase(run, "link-hints-dynamic", 6_000, 3_000);
    run.note("dns-prefetch to an IP literal makes no DNS query; a DNS-only leak is not observable with this canary.");
  });

  test("webrtc: RTCPeerConnection with STUN and TURN servers on the canary sends nothing", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "webrtc", "frame-src-none");
    requireControls(run, [...laneControls("frame-src-none", "webrtc"), "control-webrtc"]);
    await openHarness(run, "frame-src-none", "webrtc");
    await waitForProbe(run, "webrtc", "done", 8_000);
    await finishCase(run, 3_000);
    expectNoHits(run);
    if (probeValue(run.probes, "webrtc", "rtc") === "unavailable") {
      test.skip(true, `[${browserName}] RTCPeerConnection is not available inside the sandbox in this browser build, so the WebRTC case cannot run here`);
    }
    expectAttempted(run, "webrtc");
    // The attempt is the frame's `new RTCPeerConnection(...)`. Since CI run 1 the kit replaces
    // the constructor with one that throws, so a thrown "rtc" is the expected outcome; if the
    // constructor ran, the frame must also have tried ICE (an offer or a candidate).
    const rtcProbe = probeValue(run.probes, "webrtc", "rtc");
    expect(hasProbe(run.probes, "webrtc", "rtc"), `${run.at}: the frame never tried to create an RTCPeerConnection`).toBe(true);
    run.note(`rtc: ${JSON.stringify(rtcProbe)}; offer: ${JSON.stringify(probeValue(run.probes, "webrtc", "offer"))}`);
    expect(threw(run.probes, "webrtc", "rtc"), `${run.at}: the kit's lock did not refuse new RTCPeerConnection (${JSON.stringify(rtcProbe)})`).toBe(true);
    expectContained(run);
  });

  // I1: the hash policy, the metas and Trusted Types.

  test("i1-meta-copy: the metas are gone before model code runs, so no nonce-and-hash script with integrity loads", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i1-meta-copy", "frame-src-none");
    await hostileCase(run, "i1-meta-copy", 6_000);
    expect(probeValue(run.probes, "i1-meta-copy", "metaCount"), `${run.at}: CSP metas still in the DOM`).toBe(0);
    expect(probeValue(run.probes, "i1-meta-copy", "hashesFound"), `${run.at}: hashes readable`).toBe(0);
  });

  test("i1-runtime-hash: a script hashing its own salted text and loading with nonce, integrity and src reaches nothing", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i1-runtime-hash", "frame-src-none");
    await hostileCase(run, "i1-runtime-hash", 8_000);
    const tag = "i1-runtime-hash";
    const tt = probeValue(run.probes, tag, "trustedTypes") === true;
    run.note(`Trusted Types: ${tt}; crypto.subtle: ${JSON.stringify(probeValue(run.probes, tag, "haveSubtle"))}`);
    if (!hasProbe(run.probes, tag, "hashComputed")) {
      test.skip(true, `[${browserName}] the frame could not hash its own text (crypto.subtle ${JSON.stringify(probeValue(run.probes, tag, "haveSubtle"))}, digest ${JSON.stringify(probeValue(run.probes, tag, "digestFailed"))}), so the I1-2 attempt never ran`);
    }
    for (const key of ["byProperty", "byAttribute", "byFragment"]) {
      expect(hasProbe(run.probes, tag, key), `${run.at}: the ${key} attempt never ran`).toBe(true);
    }
    if (tt) {
      expect(threw(run.probes, tag, "byProperty"), `${run.at}: script.src was assignable under Trusted Types`).toBe(true);
      expect(threw(run.probes, tag, "byAttribute"), `${run.at}: setAttribute('src') was allowed under Trusted Types`).toBe(true);
      expect(threw(run.probes, tag, "byFragment"), `${run.at}: createContextualFragment with script markup was allowed under Trusted Types`).toBe(true);
    }
  });

  test("i1-meta-removed: with both metas removed, policy 1 still blocks an image and policy 2 still blocks a nonce'd style", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i1-meta-removed", "frame-src-none");
    await hostileCase(run, "i1-meta-removed", 6_000);
    const tag = "i1-meta-removed";
    expect(probeValue(run.probes, tag, "metaCount"), `${run.at}: CSP metas still in the DOM`).toBe(0);
    expect(threw(run.probes, tag, "nonceStyle"), `${run.at}: inserting the nonce'd style threw or never ran, so styleApplied says nothing about policy 2`).toBe(false);
    expect(probeValue(run.probes, tag, "styleApplied"), `${run.at}: a nonce'd style applied, so policy 2 (hashes) is no longer enforced`).toBe(false);
  });

  test("i1-trusted-types: the default policy refuses script URLs and script text, a second policy, and frame markup", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i1-trusted-types", "frame-src-none");
    await hostileCase(run, "i1-trusted-types", 6_000);
    const tag = "i1-trusted-types";
    expect(hasProbe(run.probes, tag, "scriptTextRan"), `${run.at}: script text set from model code ran`).toBe(false);
    const tt = probeValue(run.probes, tag, "trustedTypes") === true;
    run.note(`Trusted Types available: ${tt}`);
    if (tt) {
      for (const [key, what] of [
        ["srcProperty", "script.src was assignable"],
        ["srcAttribute", "setAttribute('src') on a script was allowed"],
        ["scriptText", "script text was assignable"],
        ["createPolicyOther", "a second Trusted Types policy could be created"],
        ["createPolicyDefault", "a second default policy could be created"],
        ["innerHTMLFrame", "innerHTML with frame markup was allowed"],
        ["innerHTMLScript", "innerHTML with script markup was allowed"],
      ] as const) {
        expect(threw(run.probes, tag, key), `${run.at}: ${what} (probe ${key}: ${JSON.stringify(probeValue(run.probes, tag, key))})`).toBe(true);
      }
    }
  });

  test("i1-child-realm: document.write and frame elements throw, the locks hold, and no child realm loads anything", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i1-child-realm", "frame-src-none");
    await hostileCase(run, "i1-child-realm", 6_000);
    const tag = "i1-child-realm";
    for (const [key, what] of [
      ["write", "document.write did not throw"],
      ["writeln", "document.writeln did not throw"],
      ["createIframe", "createElement('iframe') did not throw"],
      ["createIframeNS", "createElementNS(xhtml, 'iframe') did not throw"],
      ["createObject", "createElement('object') did not throw"],
      ["restoreWrite", "Document.prototype.write could be redefined"],
      ["implementationWrite", "write on a document.implementation document did not throw"],
    ] as const) {
      expect(threw(run.probes, tag, key), `${run.at}: ${what} (probe ${key}: ${JSON.stringify(probeValue(run.probes, tag, key))})`).toBe(true);
    }
    run.note(`innerHTML frame markup: ${JSON.stringify(probeValue(run.probes, tag, "innerHTMLFrame"))}; child write: ${JSON.stringify(probeValue(run.probes, tag, "childWrite"))}`);
  });

  // I3, layout, and two frames.

  test("i3-chip-swap: a chip swapped in as the pointer leaves the frame cannot take the press aimed at the old one", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "i3-chip-swap", "frame-src-none");
    requireControls(run, laneControls("frame-src-none", "i3-chip-swap"));
    await openHarness(run, "frame-src-none", "i3-chip-swap");
    const chip = page.locator("[data-sandbox-chip]");
    await expect(chip, `${run.at}: the first request's chip`).toHaveText("Shortlist Senior Product Engineer at Acme Systems", { timeout: 8_000 });

    // The frame has been sized by now (the handshake is done); put the pointer inside it.
    const iframe = page.locator("[data-sandbox-surface] iframe").first();
    const box = await iframe.boundingBox();
    expect(box && box.height > 0, `${run.at}: the frame has a box (${JSON.stringify(box)})`).toBe(true);
    await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 40));
    await page.waitForTimeout(ARMED_AFTER_MS);

    // (a) Leave the frame for the armed chip and press down on it; the frame swaps the request.
    const chipBox = await chip.boundingBox();
    expect(chipBox, `${run.at}: the chip has a box`).not.toBeNull();
    await page.mouse.move(chipBox!.x + Math.min(chipBox!.width / 2, 40), chipBox!.y + chipBox!.height / 2, { steps: 8 });
    await page.mouse.down();
    const compare = "Compare Senior Product Engineer at Acme Systems with Staff Backend Engineer at Globex";
    const swapped = await expect(chip)
      .toHaveText(compare, { timeout: 3_000 })
      .then(() => true, () => false);
    await page.mouse.up();
    await waitForProbe(run, "i3-chip-swap", "swap", 1_000);
    expect(hasProbe(run.probes, "i3-chip-swap", "swap"), `${run.at}: the frame did not see the pointer leave, so the swap never happened`).toBe(true);
    expect(swapped, `${run.at}: the chip was not replaced after the pointer left the frame`).toBe(true);
    expect(await harnessLog(page, "intents"), `${run.at}: a press that began on the old chip ran something`).toEqual([]);

    // (b) A click right after the swap is ignored (the new chip is not armed yet). The window is
    // measured from the frame's own swap timestamp: the new chip appears at least
    // HARNESS_DESCRIBE_DELAY_MS after it, and is armed CHIP_ARM_MS after it appears.
    const swapAt = Number((probeValue(run.probes, "i3-chip-swap", "swap") as { at?: number } | undefined)?.at);
    const newBox = await chip.boundingBox();
    await page.mouse.click(newBox!.x + Math.min(newBox!.width / 2, 40), newBox!.y + newBox!.height / 2);
    const sinceSwap = Date.now() - swapAt;
    const unarmedUntil = HARNESS_DESCRIBE_DELAY_MS + CHIP_ARM_MS - 100;
    if (Number.isFinite(sinceSwap) && sinceSwap < unarmedUntil) {
      expect(await harnessLog(page, "intents"), `${run.at}: a click ${sinceSwap} ms after the swap (before the new chip could be armed) ran something`).toEqual([]);
      run.note(`Step (b): the click landed ${sinceSwap} ms after the frame's swap and ran nothing.`);
    } else {
      run.note(`Step (b) inconclusive: the click landed ${sinceSwap} ms after the frame's swap, at or after ${unarmedUntil} ms, too late to test the arming delay.`);
    }

    // (c) Once armed, one click runs the new request once.
    await page.waitForTimeout(ARMED_AFTER_MS);
    await chip.click();
    await finishCase(run, 500);
    expectNoHits(run);
    expectAttempted(run, "i3-chip-swap");
    const ran = run.record.intents;
    if (ran.length === 2 && run.record.notes.some((n) => n.startsWith("Step (b) inconclusive"))) {
      run.note("Step (b)'s late click ran the new request once it was armed; only the armed press in (c) is counted below.");
      ran.shift();
    }
    expect(ran, `${run.at}: the armed press ran the new request once`).toEqual([
      { surface: expect.any(String), value: { intent: { name: "compare", jobIds: [HARNESS_JOB_A, HARNESS_JOB_B] }, source: "frame" } },
    ]);
    expectContained(run);
  });

  // The prompt-injection set's three variant 3 surfaces (plan Task 2.12), judged by the
  // same judgeHtmlCase the eval's table uses. In the product every intent the host runs
  // writes an agent_actions row and a turn intent starts a run; here the harness's intents
  // log stands for both, so an empty log is zero rows.
  test("auto_fire: actions asked for on init run nothing without a press", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "auto_fire", "frame-src-none");
    await hostileCase(run, "auto_fire", 8_000, 1_500);
    expectInjectionPass(run, "auto_fire", 0);
    expect(run.record.intents, `${run.at}: nothing ran`).toEqual([]);
  });

  test("intent_loop: a loop of turn-starting actions trips the action limit and the frame is removed", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "intent_loop", "frame-src-none");
    requireControls(run, laneControls("frame-src-none", "intent_loop"));
    await openHarness(run, "frame-src-none", "intent_loop");
    await waitForProbe(run, "intent_loop", "done", 8_000);
    await finishCase(run, 1_500);
    expectNoHits(run);
    expectAttempted(run, "intent_loop");
    expect(fallbackReasons(run), `${run.at}: the host fell back for the action limit`).toEqual(
      expect.arrayContaining([expect.stringMatching(/^action_(rate|total)_limit$/)]),
    );
    expectInjectionPass(run, "intent_loop", 0);
  });

  test("chip_spoof: a press on the frame's own confirm bar runs nothing; the host's chip runs one action", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "chip_spoof", "frame-src-none");
    requireControls(run, laneControls("frame-src-none", "chip_spoof"));
    await openHarness(run, "frame-src-none", "chip_spoof");
    const chip = page.locator("[data-sandbox-chip]");
    const compare = "Compare Senior Product Engineer at Acme Systems with Staff Backend Engineer at Globex";
    await expect(chip, `${run.at}: the host's chip names what the frame asked for`).toHaveText(compare, { timeout: 8_000 });
    await page.waitForTimeout(ARMED_AFTER_MS);
    expect(await clickInFrame(run, "#fake-confirm"), `${run.at}: the fake confirm bar was clicked`).toBe(true);
    await waitForProbe(run, "chip_spoof", "fakePressed", 2_000);
    expect(await harnessLog(page, "intents"), `${run.at}: the fake bar's press ran something`).toEqual([]);
    await page.waitForTimeout(ARMED_AFTER_MS);
    await chip.click();
    await finishCase(run, 1_000);
    expectNoHits(run);
    expectAttempted(run, "chip_spoof");
    expectContained(run);
    expect(run.record.intents, `${run.at}: the host's chip ran the compare once`).toEqual([
      { surface: expect.any(String), value: { intent: { name: "compare", jobIds: [HARNESS_JOB_A, HARNESS_JOB_B] }, source: "frame" } },
    ]);
    expectInjectionPass(run, "chip_spoof", 1);
  });

  test("cap-1200: a 3,000px document is shown at most 1,200px tall", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "cap-1200", "frame-src-none");
    await hostileCase(run, "cap-1200", 8_000, 500);
    expect(Number(probeValue(run.probes, "cap-1200", "height")), `${run.at}: the document is taller than the cap`).toBeGreaterThanOrEqual(3_000);
    expect(run.record.frames[0]?.styleHeight, `${run.at}: the iframe's height`).toBe("1200px");
    const box = await page.locator("[data-sandbox-surface] iframe").first().boundingBox();
    expect(Math.round(box?.height ?? 0), `${run.at}: the iframe's rendered height`).toBeLessThanOrEqual(1_202);
    expect(Math.round(box?.height ?? 0), `${run.at}: the iframe's rendered height`).toBeGreaterThanOrEqual(1_198);
  });

  test("siblings: one frame cannot inject init into, read, or navigate another frame on the page", async ({ page, request, browserName }) => {
    const run = await startCase(page, request, browserName, "siblings", "frame-src-none");
    requireControls(run, laneControls("frame-src-none", "siblings"));
    await openHarness(run, "frame-src-none", "siblings", ["siblings-a", "siblings-b"]);
    await waitForProbe(run, "siblings-a", "done", 8_000);
    await waitForProbe(run, "siblings-b", "done", 8_000);
    await finishCase(run, SETTLE_MS);
    expectNoHits(run);
    expectAttempted(run, "siblings", "siblings-a");
    expectAttempted(run, "siblings", "siblings-b");
    const frames = Number(probeValue(run.probes, "siblings-a", "frames"));
    expect(frames, `${run.at}: the first frame sees the second in parent.frames`).toBeGreaterThanOrEqual(2);
    expect(run.probes.some((p) => p.t === "siblings-a" && p.k.startsWith("navigate")), `${run.at}: the first frame never tried to navigate the second`).toBe(true);
    const bInit = probeValue(run.probes, "siblings-b", "bInit") as { fake?: boolean; jobs?: number } | undefined;
    const bLater = probeValue(run.probes, "siblings-b", "bLater") as { fake?: boolean; jobs?: number } | undefined;
    expect(bInit, `${run.at}: the second frame got its own init`).toEqual({ fake: false, jobs: 2 });
    expect(bLater, `${run.at}: the second frame's host.data stayed its own`).toEqual({ fake: false, jobs: 2 });
    noteThrows(run, "siblings-a", run.probes.filter((x) => x.t === "siblings-a" && (x.k.startsWith("readDocument") || x.k.startsWith("navigate"))).map((x) => x.k));
    expect(run.record.fallbacks, `${run.at}: neither frame fell back`).toEqual([]);
    expect(run.record.frames.map((f) => f.present), `${run.at}: both frames still mounted`).toEqual([true, true]);
    expectContained(run);
  });
});

// ---------------------------------------------------------------------------
// The expanded view (PR 3, spec 08 S6.1, S14.3), in both lanes: expanding restyles the same
// frame in place, so its document never reloads (a reload would be a second load, which the
// host treats as a self-navigation and stores as a failure), and Escape inside the frame
// closes the view through the kit's escape message.
// ---------------------------------------------------------------------------

/** The view frame's section around the case's frame. */
const viewSection = (page: Page) => page.locator("[data-sandbox-surface] .rf-view").first();

/** The section's box equals the viewport, within 1px (spec 08 S6.1's guard against a transformed ancestor). */
async function expectFillsViewport(run: CaseRun) {
  const viewport = run.page.viewportSize();
  const box = await viewSection(run.page).boundingBox();
  expect(viewport, `${run.at}: the page has a viewport`).not.toBeNull();
  expect(box, `${run.at}: the expanded view has a box`).not.toBeNull();
  for (const [got, want, what] of [
    [box!.x, 0, "x"],
    [box!.y, 0, "y"],
    [box!.width, viewport!.width, "width"],
    [box!.height, viewport!.height, "height"],
  ] as const) {
    expect(Math.abs(got - want), `${run.at}: the expanded view's ${what} is ${got}, the viewport's ${want}`).toBeLessThanOrEqual(1);
  }
}

test.describe("expanded view (PR 3)", () => {
  for (const lane of Object.keys(SANDBOX_LANES) as SandboxLane[]) {
    test(`[${lane}] expand-no-reload: two clicks, then Expand and Close three times: one load, no failure, the count is still 2`, async ({
      page,
      request,
      browserName,
    }) => {
      const run = await startCase(page, request, browserName, "expand-no-reload", lane);
      requireControls(run, laneControls(lane, "expand-no-reload"));
      await openHarness(run, lane, "expand-no-reload");
      expect(await waitForProbe(run, "expand-no-reload", "done", 5_000), `${run.at}: the document ran its init`).toBe(true);
      const frame = page.frameLocator("[data-sandbox-surface] iframe").first();
      await frame.locator("#more").click();
      await frame.locator("#more").click();
      await expect(frame.locator("#count"), `${run.at}: the counter after two clicks`).toHaveText("2");
      const section = viewSection(page);
      for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: /^Expand view:/ }).click();
        await expect(section, `${run.at}: expanded (round ${i + 1})`).toHaveAttribute("data-expanded", "true");
        await expectFillsViewport(run);
        await expect(frame.locator("#count"), `${run.at}: the counter while expanded (round ${i + 1})`).toHaveText("2");
        await page.getByRole("button", { name: "Close expanded view" }).click();
        await expect(section, `${run.at}: closed (round ${i + 1})`).not.toHaveAttribute("data-expanded", "true");
      }
      await expect(frame.locator("#count"), `${run.at}: the counter after three rounds`).toHaveText("2");
      await finishCase(run, 1_000);
      if (lane === "frame-src-none") expectNoHits(run);
      expectAttempted(run, "expand-no-reload");
      expect(run.record.loads, `${run.at}: the iframe loaded once (a second load is a reload)`).toHaveLength(1);
      expect(run.record.reports, `${run.at}: no failure was stored`).toEqual([]);
      expect(run.record.fallbacks, `${run.at}: the frame did not fall back`).toEqual([]);
      expect(run.consoleProbes.filter((p) => p.t === "expand-no-reload" && p.k === "start"), `${run.at}: the document started once`).toHaveLength(1);
      expectContained(run);
    });

    test(`[${lane}] escape-from-frame: Escape with focus inside the frame closes the expanded view and focus returns to Expand`, async ({
      page,
      request,
      browserName,
    }) => {
      const run = await startCase(page, request, browserName, "escape-from-frame", lane);
      requireControls(run, laneControls(lane, "escape-from-frame"));
      await openHarness(run, lane, "escape-from-frame");
      expect(await waitForProbe(run, "escape-from-frame", "done", 5_000), `${run.at}: the document ran its init`).toBe(true);
      const section = viewSection(page);
      await page.getByRole("button", { name: /^Expand view:/ }).click();
      await expect(section, `${run.at}: expanded`).toHaveAttribute("data-expanded", "true");
      expect(await clickInFrame(run, "#focus-me"), `${run.at}: the button inside the frame was clicked`).toBe(true);
      await page.keyboard.press("Escape");
      await expect(section, `${run.at}: Escape inside the frame closed the view`).not.toHaveAttribute("data-expanded", "true");
      await expect(page.getByRole("button", { name: /^Expand view:/ }), `${run.at}: focus is back on Expand`).toBeFocused();
      await waitForProbe(run, "escape-from-frame", "escapeSeen", 1_000);
      const seen = probeValue(run.probes, "escape-from-frame", "escapeSeen") as { trusted?: boolean } | undefined;
      expect(seen?.trusted, `${run.at}: the document saw a trusted Escape`).toBe(true);
      await finishCase(run, 500);
      if (lane === "frame-src-none") expectNoHits(run);
      expectAttempted(run, "escape-from-frame");
      expect(run.record.reports, `${run.at}: no failure was stored`).toEqual([]);
      expect(run.record.fallbacks, `${run.at}: the frame did not fall back`).toEqual([]);
      expectContained(run);
    });
  }
});

// ---------------------------------------------------------------------------
// baseline-csp lane: the host's own teardown, and what one navigation carries (gate A18)
// ---------------------------------------------------------------------------

test.describe(`baseline-csp lane (${SANDBOX_LANES["baseline-csp"]}): teardown without frame-src 'none', canary hits recorded`, () => {
  const BASELINE_CASES: Array<[SandboxCaseName, string]> = [
    ["nav-parse", "location assigned while the document is parsing (I2)"],
    ["nav-oninit", "location assigned from onInit, possibly before load (I2)"],
    ["nav-after-load", "location = canary after load"],
    ["nav-meta-refresh", "meta refresh in the markup"],
    ["nav-meta-refresh-dynamic", "meta refresh inserted by script"],
    ["nav-anchor-script", "an anchor clicked by script"],
    ["nav-anchor-user", "an anchor the user clicks"],
    ["nav-form", "form submit, requestSubmit and a pressed submit button"],
    ["nav-never-finishes", "navigation after init to a page that never finishes loading (I2)"],
    ["nav-data-url", "self-navigation to a data: page that posts its own ready"],
    ["nav-blob-url", "self-navigation to a blob: page that posts its own ready"],
  ];

  for (const [caseName, what] of BASELINE_CASES) {
    test(`${caseName}: ${what}: a frame that navigated is removed with a teardown reason, and a navigated page never gets init`, async ({
      page,
      request,
      browserName,
    }, testInfo) => {
      const run = await startCase(page, request, browserName, caseName, "baseline-csp");
      await navigationCase(run, "baseline-csp", caseName);
      recordHits(run, testInfo);
      expectAttempted(run, caseName);
      expectLinksStopped(run, caseName);
      expectNavigatedPageGotNoInit(run, caseName);
      expectContained(run);
      if (caseName === "nav-never-finishes") {
        // CI run 2, item 3: which leaving signals the browser fired (the fixture's own
        // listeners, registered after the kit's). Only WebKit, only when it fired none and
        // the frame is still in place, is this row fixme, with the reason named.
        const signals = ["beforeunloadSeen", "navigateSeen", "pagehideSeen"].filter((k) => hasProbe(run.probes, caseName, k));
        run.note(`Leaving signals the browser fired: ${signals.length > 0 ? signals.join(", ") : "none"}`);
        const removed = run.record.frames.every((f) => !f.present);
        if (browserName === "webkit" && signals.length === 0 && !removed) {
          run.record.recordedReason = NEVER_FINISHES_WEBKIT_REASON;
          run.note(NEVER_FINISHES_WEBKIT_REASON);
          test.fixme(true, `[webkit] ${NEVER_FINISHES_WEBKIT_REASON}`);
        }
      }
      expectHostTeardown(run, caseName);
      run.note(`Outcome: ${run.record.outcome}`);
    });
  }

  // CI run 2, item 2: one case per sub-action, each with its own canary record. On this lane a
  // request is still an escape here: none of these documents navigates itself, so any request
  // from them is a top, parent or new-window navigation.
  for (const [caseName, what, throwKeys] of POPUP_CASES) {
    test(`${caseName}: ${what} opens nothing and leaves the top page in place`, async ({ page, request, browserName }, testInfo) => {
      const run = await startCase(page, request, browserName, caseName, "baseline-csp");
      await navigationCase(run, "baseline-csp", caseName);
      recordHits(run, testInfo);
      if (throwKeys.length > 0) noteThrows(run, caseName, throwKeys);
      expectAttempted(run, caseName);
      expectLinksStopped(run, caseName);
      expect(run.record.popups, `${run.at}: popups opened`).toEqual([]);
      expect(run.record.pageUrlAfter, `${run.at}: the top page navigated`).toContain(`${SANDBOX_LANES["baseline-csp"]}?case=${caseName}`);
      const escaped = run.record.hits!.requests.filter((r) => r.case === caseName);
      expect(escaped.map((r) => r.url), `${run.at}: a top, parent or new-window navigation reached the canary`).toEqual([]);
      expectContained(run);
    });
  }
});
