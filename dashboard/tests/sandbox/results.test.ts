import { describe, expect, test } from "vitest";
import { hasProbe, mergeProbes, parseProbe, probeValue, resultFileName, summariseHits, threw, type CanaryHits } from "./results";

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

  test("resultFileName is filesystem-safe and names the browser", () => {
    expect(resultFileName("webkit", "nav-parse: location during parse (I2)")).toBe("webkit--nav-parse-location-during-parse-i2.json");
    expect(resultFileName("firefox", "!!!")).toBe("firefox--case.json");
  });
});
