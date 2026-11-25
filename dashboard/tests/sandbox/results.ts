// Pure helpers for the sandbox enforcement suite (tests/sandbox/sandbox.spec.ts): probe
// parsing, the canary record's summary, and the per-case result file. Tested in
// results.test.ts with vitest; nothing here touches a browser.
import path from "node:path";

/** Where each case writes its JSON result; CI uploads it on success and failure. */
export const SANDBOX_RESULTS_DIR = path.join("test-results", "sandbox", "results");
export const PROBE_PREFIX = "SBXPROBE ";

export interface Probe {
  /** The frame tag (the case name, or siblings-a / siblings-b). */
  t: string;
  k: string;
  v: unknown;
}

export interface CanaryHits {
  total: number;
  tcpConnections: number;
  requests: Array<{ method?: string; url?: string; secFetchDest?: string; secFetchMode?: string; purpose?: string }>;
  upgrades: Array<{ url?: string }>;
  udpDatagrams: Array<{ from?: string; bytes?: number }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One probe from a console line or a line of a frame's <pre id="probe">, or null. */
export function parseProbe(line: string): Probe | null {
  const text = line.startsWith(PROBE_PREFIX) ? line.slice(PROBE_PREFIX.length) : line;
  if (!text.trim().startsWith("{")) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.t !== "string" || typeof raw.k !== "string") return null;
  return { t: raw.t, k: raw.k, v: raw.v ?? null };
}

/** The probes of both channels, in arrival order, each distinct probe once. */
export function mergeProbes(...lists: Probe[][]): Probe[] {
  const seen = new Set<string>();
  const out: Probe[] = [];
  for (const list of lists) {
    for (const p of list) {
      const key = JSON.stringify([p.t, p.k, p.v]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

export function probeValue(probes: Probe[], tag: string, key: string): unknown {
  return probes.find((p) => p.t === tag && p.k === key)?.v;
}

export function hasProbe(probes: Probe[], tag: string, key: string): boolean {
  return probes.some((p) => p.t === tag && p.k === key);
}

/** For a T(...) probe: true when the call threw, false when it returned, undefined when absent. */
export function threw(probes: Probe[], tag: string, key: string): boolean | undefined {
  const v = probeValue(probes, tag, key);
  if (!isRecord(v) || typeof v.ok !== "boolean") return undefined;
  return !v.ok;
}

/** What reached the canary, in one line for an assertion message. */
export function summariseHits(h: CanaryHits): string {
  if (h.total === 0) return "nothing";
  const parts: string[] = [];
  if (h.requests.length > 0) {
    const shown = h.requests.slice(0, 6).map((r) => `${r.method ?? "?"} ${r.url ?? "?"}${r.secFetchDest ? ` (${r.secFetchDest})` : ""}`);
    parts.push(`${h.requests.length} HTTP request(s): ${shown.join(", ")}${h.requests.length > 6 ? ", ..." : ""}`);
  }
  if (h.upgrades.length > 0) parts.push(`${h.upgrades.length} WebSocket upgrade(s): ${h.upgrades.map((u) => u.url).join(", ")}`);
  if (h.udpDatagrams.length > 0) parts.push(`${h.udpDatagrams.length} UDP datagram(s) (STUN/TURN)`);
  if (h.tcpConnections > 0) parts.push(`${h.tcpConnections} TCP connection(s)`);
  return parts.join("; ");
}

/** A file name for one case's result: browser and test title, filesystem-safe. */
export function resultFileName(browser: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${browser}--${slug || "case"}.json`;
}
