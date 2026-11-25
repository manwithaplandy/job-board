import { describe, expect, test } from "vitest";
import {
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
} from "./results";

const empty: CanaryHits = { total: 0, tcpConnections: 0, requests: [], upgrades: [], udpDatagrams: [] };

describe("sandbox suite helpers", () => {
  test("parseProbe reads console lines and probe-element lines, and nothing else", () => {
    expect(parseProbe('SBXPROBE {"t":"benign","k":"start","v":{"origin":"null"}}')).toEqual({ t: "benign", k: "start", v: { origin: "null" } });
    expect(parseProbe('{"t":"benign","k":"done","v":null}')).toEqual({ t: "benign", k: "done", v: null });
    expect(parseProbe("SBXPROBE not json")).toBeNull();
    expect(parseProbe("[HMR] connected")).toBeNull();
    expect(parseProbe('{"t":1,"k":"x"}')).toBeNull();
    expect(parseProbe("")).toBeNull();
  });

  test("mergeProbes keeps arrival order and drops the copy the other channel saw", () => {
    const a = { t: "x", k: "start", v: null };
    const b = { t: "x", k: "done", v: null };
    expect(mergeProbes([a], [a, b])).toEqual([a, b]);
  });

  test("threw reads T() outcomes", () => {
    const probes = [
      { t: "x", k: "a", v: { ok: false, e: "SecurityError" } },
      { t: "x", k: "b", v: { ok: true, r: null } },
    ];
    expect(threw(probes, "x", "a")).toBe(true);
    expect(threw(probes, "x", "b")).toBe(false);
    expect(threw(probes, "x", "c")).toBeUndefined();
    expect(hasProbe(probes, "x", "a")).toBe(true);
    expect(probeValue(probes, "y", "a")).toBeUndefined();
  });

  test("summariseHits names what reached the canary", () => {
    expect(summariseHits(empty)).toBe("nothing");
    const s = summariseHits({
      total: 4,
      tcpConnections: 1,
      requests: [{ method: "GET", url: "/c/nav-parse/nav", secFetchDest: "iframe" }],
      upgrades: [{ url: "/c/subresources/ws" }],
      udpDatagrams: [{ from: "127.0.0.1:5000", bytes: 20 }],
    });
    expect(s).toContain("GET /c/nav-parse/nav (iframe)");
    expect(s).toContain("1 WebSocket upgrade(s)");
    expect(s).toContain("1 UDP datagram(s)");
    expect(s).toContain("1 TCP connection(s)");
  });

  test("summariseHits says what each TCP connection carried, so a bare connect is visible", () => {
    const s = summariseHits({
      ...empty,
      total: 2,
      tcpConnections: 2,
      connections: [
        { id: 1, bytesRead: 0, firstBytes: "", httpRequests: 0 },
        { id: 2, bytesRead: 5, firstBytes: "....x", httpRequests: 0 },
      ],
    });
    expect(s).toBe('2 TCP connection(s): 1 bare (no bytes), 1 with bytes but no HTTP request (5 B "....x")');
  });

  test("navigationRequests keeps document and frame loads and form submissions, not subresources", () => {
    const hits: CanaryHits = {
      ...empty,
      total: 3,
      requests: [
        { url: "/c/nav-parse/nav", secFetchDest: "iframe", secFetchMode: "navigate" },
        { url: "/c/nav-form/form?q=x", secFetchMode: "navigate" },
        { url: "/c/subresources/img", secFetchDest: "image", secFetchMode: "no-cors" },
      ],
    };
    expect(navigationRequests(hits).map((r) => r.url)).toEqual(["/c/nav-parse/nav", "/c/nav-form/form?q=x"]);
  });

  test("inlineScriptRefusals finds the frame's own refused inline scripts only", () => {
    const probes = [
      { t: "x", k: "csp", v: { d: "script-src-elem", b: "inline" } },
      { t: "x", k: "csp", v: { d: "img-src", b: "http://127.0.0.1:4599/c/x/img" } },
      { t: "x", k: "csp", v: { d: "script-src", b: "eval" } },
      { t: "y", k: "csp", v: { d: "script-src-elem", b: "inline" } },
    ];
    expect(inlineScriptRefusals(probes, "x")).toEqual([probes[0]]);
  });

  test("resultFileName is filesystem-safe and names the browser", () => {
    expect(resultFileName("webkit", "nav-parse: location during parse (I2)")).toBe("webkit--nav-parse-location-during-parse-i2.json");
    expect(resultFileName("firefox", "!!!")).toBe("firefox--case.json");
  });
});
