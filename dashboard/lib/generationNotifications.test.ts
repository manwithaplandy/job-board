import { describe, expect, test } from "vitest";
import {
  NOTIFIED_STORAGE_KEY,
  readNotifiedIds,
  recordNotified,
  settledUnnotified,
  toastCopyFor,
} from "@/lib/generationNotifications";
import type { GenerationJobView } from "@/lib/generationJobCodec";

const job = (over: Partial<GenerationJobView>): GenerationJobView => ({
  id: "g1",
  jobId: "ashby:acme:1",
  kind: "resume",
  status: "ready",
  error: null,
  jobTitle: "Engineer",
  company: "Acme",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:01:00.000Z",
  ...over,
});

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    dump: () => Object.fromEntries(map),
  };
}

describe("readNotifiedIds — storage boundary total parse", () => {
  test("round-trips what recordNotified wrote", () => {
    const s = fakeStorage();
    recordNotified(s, {}, "g1", 1_000);
    expect(readNotifiedIds(s)).toEqual({ g1: 1_000 });
  });

  for (const [label, raw] of [
    ["corrupt JSON", "{oops"],
    ["array payload", "[1,2]"],
    ["scalar payload", '"hi"'],
  ] as const) {
    test(`${label} degrades to {}`, () => {
      const s = fakeStorage({ [NOTIFIED_STORAGE_KEY]: raw });
      expect(readNotifiedIds(s)).toEqual({});
    });
  }

  test("non-numeric entries are dropped, numeric kept", () => {
    const s = fakeStorage({ [NOTIFIED_STORAGE_KEY]: JSON.stringify({ a: 5, b: "soon", c: null }) });
    expect(readNotifiedIds(s)).toEqual({ a: 5 });
  });

  test("null storage (SSR / blocked) degrades to {}", () => {
    expect(readNotifiedIds(null)).toEqual({});
  });

  test("a storage that throws degrades to {}", () => {
    const throwing = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
    };
    expect(readNotifiedIds(throwing)).toEqual({});
    // recordNotified stays best-effort: the in-memory record still advances.
    expect(recordNotified(throwing, {}, "g1", 7)).toEqual({ g1: 7 });
  });
});

describe("recordNotified", () => {
  test("prunes entries older than the TTL", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const s = fakeStorage();
    const next = recordNotified(s, { old: 0, fresh: DAY - 1 }, "g1", DAY + 1);
    expect(next).toEqual({ fresh: DAY - 1, g1: DAY + 1 });
    expect(readNotifiedIds(s)).toEqual(next);
  });
});

describe("settledUnnotified", () => {
  test("returns settled jobs not yet toasted; pending and already-toasted are skipped", () => {
    const ready = job({ id: "r" });
    const failed = job({ id: "f", status: "failed" });
    const pending = job({ id: "p", status: "pending" });
    const seen = job({ id: "s" });
    expect(settledUnnotified([ready, failed, pending, seen], { s: 123 })).toEqual([ready, failed]);
  });
});

describe("toastCopyFor", () => {
  test("clean ready → success with kind title + company", () => {
    expect(toastCopyFor(job({ kind: "cover" }))).toEqual({
      tone: "success", title: "Cover letter ready · Acme", description: null,
    });
  });

  test("ready prepare with a partial note → warning carrying the note", () => {
    const copy = toastCopyFor(job({ kind: "prepare", error: "Couldn’t generate the résumé — you can retry it from the job pane." }));
    expect(copy.tone).toBe("warning");
    expect(copy.title).toBe("Application prefilled · Acme");
    expect(copy.description).toContain("résumé");
  });

  test("failed → error with the stored user-safe message", () => {
    const copy = toastCopyFor(job({ status: "failed", error: "Résumé generation timed out — please try again." }));
    expect(copy).toEqual({
      tone: "error",
      title: "Résumé generation failed · Acme",
      description: "Résumé generation timed out — please try again.",
    });
  });

  test("company-less job drops the suffix", () => {
    expect(toastCopyFor(job({ company: null })).title).toBe("Résumé ready");
  });
});
