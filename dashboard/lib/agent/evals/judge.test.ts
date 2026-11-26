// The judge (plan Task 2.13): the prompt is blind to the variant, the order is random and
// mapped back, a bad reply is a tie, pairs come from matching matrix cells, and the hand
// check samples ceil(n * 0.1). A mock model stands in; no network.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4CallOptions } from "@ai-sdk/provider";
import {
  JUDGE_SYSTEM,
  awaitsRender,
  handCheckCsv,
  judgePair,
  judgePairs,
  judgePrompt,
  judgeQueue,
  judgeTable,
  parseJudgeReply,
  sampleForHandCheck,
  surfaceText,
  tallyJudge,
  type JudgeResult,
} from "@/lib/agent/evals/judge";
import { parseRecording, type Recording } from "@/lib/agent/evals/recording";

const EVALS = path.join(process.cwd(), "lib", "agent", "evals");
const readJson = (...p: string[]) => JSON.parse(readFileSync(path.join(EVALS, ...p), "utf8")) as unknown;

function base(): Recording {
  const r = parseRecording(readJson("recordings", "v1", "b_compare.senior-backend.handwritten.json"));
  if (!r) throw new Error("the golden b_compare recording does not parse");
  return r;
}

/** The b_compare cell in `variant`: the golden recording with surface 0 replaced by the fixture's payload. */
function cell(variant: 1 | 2 | 3, over: Partial<Recording> = {}): Recording {
  const r = base();
  if (variant !== 1) {
    const fixture = readJson("fixtures", "surfaces", `v${variant}-compare.json`) as { payload: Record<string, unknown> };
    r.surfaces = [{ ...r.surfaces[0], variant, payload: fixture.payload, fallbackPayload: r.surfaces[0].payload, outcome: "valid" }];
  } else {
    r.surfaces = [r.surfaces[0]];
  }
  return { ...r, variant, source: "rerender", model: "anthropic/claude-sonnet-5.5", seed: 1, ...over };
}

function reply(text: string) {
  const calls: LanguageModelV4CallOptions[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 900, noCache: 900, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 40, text: 40, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, calls };
}

function promptOf(call: LanguageModelV4CallOptions): string {
  return call.prompt
    .filter((m) => m.role === "user")
    .flatMap((m) => (typeof m.content === "string" ? [m.content] : m.content.map((p) => ("text" in p ? p.text : ""))))
    .join("\n");
}

const NAMES_A_VARIANT = /variant|\bv[123]\b|sandbox|iframe|\bhtml\b|\bjson\b|<[a-z]/i;

describe("the judge prompt", () => {
  test("the judge prompt never names the variant", () => {
    for (const [x, y] of [
      [1, 2],
      [1, 3],
      [2, 3],
    ] as const) {
      const prompt = judgePrompt(cell(x), cell(y));
      expect(prompt).not.toMatch(NAMES_A_VARIANT);
    }
    // The system prompt's only JSON is the reply format, and it names no variant either.
    expect(JUDGE_SYSTEM).not.toMatch(/variant|\bv[123]\b|sandbox|iframe|\bhtml\b/i);
  });

  test("a surface's own words that would name a variant are redacted", () => {
    const r = cell(2);
    r.surfaces[0].payload = { variant: 2, title: "Variant 2 view", root: { type: "Text", text: "Rendered as v3 in the sandbox iframe, from HTML" } };
    expect(surfaceText(r.surfaces[0])).not.toMatch(NAMES_A_VARIANT);
  });

  test("every variant shows the same jobs, fit scores and pay to the judge", () => {
    for (const v of [1, 2] as const) {
      const text = surfaceText(cell(v).surfaces[0]);
      expect(text, `variant ${v}`).toMatch(/94/);
      expect(text, `variant ${v}`).toMatch(/92/);
      expect(text, `variant ${v}`).toMatch(/\[control: Shortlist\]/);
    }
    // A document's own words, without a render: no styles or script, and no figures (it
    // fills them in when it runs).
    const unrendered = surfaceText(cell(3).surfaces[0]);
    expect(unrendered).toMatch(/Two backend roles side by side/);
    expect(unrendered).not.toMatch(/grid-template-columns|host\.onInit|94/);
    // With the render smoke's text it reads like the others.
    const rendered = "Platform Engineer\nAcme\nFit 94\n$150k to $175k\n [control: Shortlist] ";
    expect(surfaceText(cell(3).surfaces[0], rendered)).toMatch(/Fit 94[\s\S]*\[control: Shortlist\]/);
  });

  test("a pair whose document was not rendered awaits the render smoke", () => {
    const v3 = cell(3);
    expect(awaitsRender(cell(1), null)).toBe(false);
    expect(awaitsRender(cell(2), null)).toBe(false);
    expect(awaitsRender(v3, null)).toBe(true);
    expect(awaitsRender(v3, () => null)).toBe(true);
    expect(awaitsRender(v3, (r, i) => (r.variant === 3 && i === 0 ? "Fit 94" : null))).toBe(false);
    expect(judgePrompt(cell(1), v3, () => "Rendered words: Fit 94")).toContain("Rendered words: Fit 94");
  });

  test("a surface that fell back is read as its fallback, what the user saw", () => {
    const r = cell(2);
    r.surfaces[0] = { ...r.surfaces[0], outcome: "fallback", payload: { variant: 2, title: "never shown", root: { type: "Text", text: "never shown" } } };
    expect(surfaceText(r.surfaces[0])).not.toMatch(/never shown/);
  });
});

describe("judgePair", () => {
  test("shows a first when random is below 0.5 and maps the verdict back", async () => {
    const { model, calls } = reply('{"winner":"first","reason":"Clearer next step."}');
    const v = await judgePair(cell(1), cell(2), { model, random: () => 0.1 });
    expect(v).toEqual({ winner: "a", reason: "Clearer next step.", shownFirst: "a", parsed: true });
    expect(calls).toHaveLength(1);
    expect(promptOf(calls[0])).not.toMatch(NAMES_A_VARIANT);
  });

  test("shows b first otherwise, so 'first' means b", async () => {
    const { model } = reply('Here: {"winner":"first","reason":"Easier to scan."}');
    expect(await judgePair(cell(1), cell(3), { model, random: () => 0.9 })).toMatchObject({ winner: "b", shownFirst: "b", parsed: true });
    const second = reply('{"winner":"second","reason":"x"}');
    expect(await judgePair(cell(1), cell(3), { model: second.model, random: () => 0.9 })).toMatchObject({ winner: "a" });
  });

  test("a tie stays a tie, and a reply that does not parse is a tie marked unparsed", async () => {
    expect(await judgePair(cell(2), cell(3), { model: reply('{"winner":"tie","reason":"Same."}').model, random: () => 0.2 })).toMatchObject({ winner: "tie", parsed: true });
    expect(await judgePair(cell(2), cell(3), { model: reply("I prefer the first one.").model })).toMatchObject({ winner: "tie", parsed: false });
    expect(parseJudgeReply('{"winner":"a","reason":"x"}')).toBeNull();
    expect(parseJudgeReply('{"winner":"second","reason":""}')).toBeNull();
  });

  test("asks for one short reply with no retries", async () => {
    const { model, calls } = reply('{"winner":"tie","reason":"Same."}');
    await judgePair(cell(1), cell(2), { model, random: () => 0.3 });
    expect(calls[0].maxOutputTokens).toBeLessThanOrEqual(2_000);
  });
});

describe("pairs and the hand check", () => {
  test("pairs the variants of one cell, never across models, scenarios, personas or repeats", () => {
    const rs = [
      cell(1),
      cell(2),
      cell(3),
      cell(1, { seed: 2 }),
      cell(3, { seed: 2 }),
      cell(2, { model: "anthropic/claude-haiku-5.5" }),
      cell(3, { model: "anthropic/claude-haiku-5.5", persona: "new-grad" }),
    ];
    const pairs = judgePairs(rs);
    expect(pairs.map((p) => [p.model, p.persona, p.seed, p.a.variant, p.b.variant])).toEqual([
      ["anthropic/claude-sonnet-5.5", "senior-backend", 1, 1, 2],
      ["anthropic/claude-sonnet-5.5", "senior-backend", 1, 1, 3],
      ["anthropic/claude-sonnet-5.5", "senior-backend", 1, 2, 3],
      ["anthropic/claude-sonnet-5.5", "senior-backend", 2, 1, 3],
    ]);
  });

  test("never pairs a cell with the same cell from another run", () => {
    const A = "20261126T010000Z";
    const B = "20261126T020000Z";
    const pairs = judgePairs([cell(1, { evalRun: A }), cell(2, { evalRun: B }), cell(3, { evalRun: A })]);
    expect(pairs.map((p) => [p.a.evalRun, p.a.variant, p.b.evalRun, p.b.variant])).toEqual([[A, 1, A, 3]]);
  });

  test("the queue takes repeats in turn: the default 144 is the first two repeats of the full matrix of two models", () => {
    const rs: Recording[] = [];
    for (const model of ["anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5"]) {
      for (const scenario of ["a_resume_upload", "b_compare", "c_prep", "d_weekly"] as const) {
        for (const persona of ["senior-backend", "career-switcher", "new-grad"] as const) {
          for (let seed = 1; seed <= 5; seed++) for (const v of [1, 2, 3] as const) rs.push(cell(v, { model, scenario, persona, seed }));
        }
      }
    }
    const all = judgePairs(rs);
    expect(all).toHaveLength(360);
    const queue = judgeQueue(all);
    expect(queue).toHaveLength(360);
    const picked = queue.slice(0, 144);
    expect(new Set(picked.map((p) => p.seed))).toEqual(new Set([1, 2]));
    expect(picked.filter((p) => p.seed === 1)).toHaveLength(72);
  });

  test("sampleForHandCheck picks ceil(n * 0.1) pairs", () => {
    for (const n of [0, 1, 9, 10, 11, 144, 360]) {
      const pairs = Array.from({ length: n }, (_, i) => i);
      const sample = sampleForHandCheck(pairs);
      expect(sample).toHaveLength(Math.ceil(n * 0.1));
      expect(new Set(sample).size).toBe(sample.length);
      expect([...sample].sort((x, y) => x - y)).toEqual(sample);
    }
    expect(sampleForHandCheck([1, 2, 3, 4], 0.5, () => 0)).toHaveLength(2);
    expect(() => sampleForHandCheck([1], 0)).toThrow();
  });

  const result = (over: Partial<JudgeResult>): JudgeResult => ({
    model: "anthropic/claude-sonnet-5.5",
    scenario: "b_compare",
    persona: "senior-backend",
    seed: 1,
    variantA: 1,
    variantB: 2,
    shownFirst: "a",
    winner: "a",
    reason: "Clearer.",
    parsed: true,
    ...over,
  });

  test("the hand-check CSV has a row per pair, quotes commas and defuses formulas", () => {
    const csv = handCheckCsv([result({ reason: 'Fewer steps, "clearer" labels' }), result({ winner: "tie", reason: "=HYPERLINK(1)" })]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("model,scenario,persona,seed,variant_a,variant_b,judge_winner,judge_reason,andrew_winner,andrew_note");
    expect(lines[1]).toBe('anthropic/claude-sonnet-5.5,b_compare,senior-backend,1,1,2,v1,"Fewer steps, ""clearer"" labels",,');
    expect(lines[2]).toContain(",tie,'=HYPERLINK(1),,");
  });

  test("the tally counts wins, ties and unparsed replies per pairing", () => {
    const rs = [result({}), result({ winner: "b" }), result({ winner: "tie", parsed: false }), result({ variantA: 2, variantB: 3, winner: "b" })];
    expect(tallyJudge(rs)).toEqual([
      { model: "anthropic/claude-sonnet-5.5", variantA: 1, variantB: 2, pairs: 3, winsA: 1, winsB: 1, ties: 1, unparsed: 1 },
      { model: "anthropic/claude-sonnet-5.5", variantA: 2, variantB: 3, pairs: 1, winsA: 0, winsB: 1, ties: 0, unparsed: 0 },
    ]);
    expect(judgeTable(rs)).toContain("| anthropic/claude-sonnet-5.5 | 1 vs 2 | 3 | 1 | 1 | 1 | 1 |");
    expect(judgeTable([])).toBe("No judged pairs.");
  });
});
