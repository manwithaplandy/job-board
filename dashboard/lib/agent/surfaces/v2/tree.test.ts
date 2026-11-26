// The variant 2 primitive tree (plan Task 2.1, spec 7.1 "Primitives + tokens"): exactly 19
// node types styled only by token enums, data bound by pointer into the turn's gathered
// data, caps on depth, nodes and text, and every error a short plain string the model can
// repair from.
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { emptyGathered } from "@/lib/agent/gathered";
import { gatheredFixture, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";
import { everyNode } from "@/lib/agent/surfaces/v2/testFixtures";
import {
  SurfacePayloadV2Schema,
  V2_LIMITS,
  V2_NODE_TYPES,
  V2NodeSchema,
  resolveBind,
  validateSurfaceV2,
} from "@/lib/agent/surfaces/v2/tree";
import { resolveRowBind, resolveRowsBind } from "@/lib/agent/surfaces/v2/bind";

const text = (t = "Hello") => ({ type: "Text", text: t });
const stack = (...children: unknown[]) => ({ type: "Stack", gap: "2", children });
const v2 = (root: unknown, extra: Record<string, unknown> = {}) => ({ variant: 2, root, ...extra });

function errorsOf(payload: unknown, gathered = gatheredFixture()): string[] {
  const out = validateSurfaceV2(payload, gathered);
  return out.ok ? [] : out.errors;
}

/** A chain of `depth` nodes: Stacks around one Text. */
function nested(depth: number): unknown {
  let node: unknown = text();
  for (let i = 1; i < depth; i++) node = stack(node);
  return node;
}

describe("V2NodeSchema", () => {
  test("is a closed union over exactly 19 node types", () => {
    expect(V2_NODE_TYPES).toEqual([
      "Stack", "Grid", "Card", "Tabs", "Divider", "Heading", "Text", "Badge", "List", "Stat", "Table", "Chart",
      "Button", "Field", "Select", "JobTitle", "FitScore", "Pay", "PostingLink",
    ]);
    const samples = everyNode();
    expect(samples.map((n) => (n as { type: string }).type)).toEqual(V2_NODE_TYPES);
    for (const n of samples) expect(V2NodeSchema.safeParse(n).success, JSON.stringify(n)).toBe(true);
  });

  test("a 20th node type, a style key or an href key fails", () => {
    expect(V2NodeSchema.safeParse({ type: "Image", src: "x" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ type: "Html", html: "<b>x</b>" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ ...text(), style: "color: red" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ ...text(), className: "x" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ type: "PostingLink", jobId: JOB_A, href: "https://evil.example" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ type: "Card", color: "red", children: [text()] }).success).toBe(false);
    // Styling is token enums only.
    expect(V2NodeSchema.safeParse({ type: "Stack", gap: "16px", children: [text()] }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ type: "Badge", text: "x", tone: "#ff0000" }).success).toBe(false);
    expect(V2NodeSchema.safeParse({ type: "Grid", columns: 5, children: [text()] }).success).toBe(false);
    expect(errorsOf(v2({ ...text(), style: "x" }))).toEqual([expect.stringContaining("root")]);
    expect(errorsOf(v2(stack(text(), { type: "Image", src: "x" }))).length).toBeGreaterThan(0);
  });

  test("no node schema has a style, className, color, width, url, href, src or html field", () => {
    const forbidden = /^(style|className|color|width|url|href|src|html)$/i;
    const names: string[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node !== "object" || node === null) return;
      const props = (node as { properties?: Record<string, unknown> }).properties;
      if (props) names.push(...Object.keys(props));
      Object.values(node).forEach(visit);
    };
    visit(z.toJSONSchema(SurfacePayloadV2Schema, { io: "input", target: "draft-7" }));
    expect(names.length).toBeGreaterThan(20);
    expect(names.filter((n) => forbidden.test(n))).toEqual([]);
  });
});

describe("validateSurfaceV2", () => {
  test("a tree with every node type, all binds and ids resolving, passes unchanged", () => {
    const payload = v2({ type: "Stack", gap: "3", children: everyNode() }, { title: "Your matches" });
    expect(validateSurfaceV2(payload, gatheredFixture())).toEqual({ ok: true, payload });
  });

  test("depth 7 fails; 121 nodes fail; text of 401 chars fails", () => {
    expect(errorsOf(v2(nested(V2_LIMITS.maxDepth)))).toEqual([]);
    expect(errorsOf(v2(nested(V2_LIMITS.maxDepth + 1)))).toEqual([expect.stringMatching(/deeper than 6/)]);
    // 1 Stack + 119 Texts = 120 nodes: fine; one more fails.
    const many = (n: number) => v2({ type: "Stack", gap: "1", children: Array.from({ length: n - 1 }, () => text()) });
    expect(errorsOf(many(V2_LIMITS.maxNodes))).toEqual([]);
    expect(errorsOf(many(V2_LIMITS.maxNodes + 1))).toEqual([expect.stringMatching(/more than 120 nodes/)]);
    expect(errorsOf(v2(text("x".repeat(V2_LIMITS.maxTextChars))))).toEqual([]);
    expect(errorsOf(v2(text("x".repeat(V2_LIMITS.maxTextChars + 1))))).toEqual([expect.stringContaining("root.text")]);
    expect(errorsOf(v2({ type: "List", items: ["ok", "y".repeat(401)] }))).toEqual([expect.stringContaining("root.items.1")]);
  });

  test("a hostile depth is refused before the schema walks it", () => {
    expect(errorsOf(v2(nested(5000)))).toEqual([expect.stringMatching(/deeper than 6/)]);
  });

  test("a bind that does not resolve in gathered data is reported with its pointer", () => {
    const missing = `/reviews/${JOB_B}/fitScore`;
    expect(errorsOf(v2({ type: "Stat", label: "Fit", bind: missing }))).toEqual([
      `root.bind: ${missing} does not resolve in the data read this turn`,
    ]);
    expect(errorsOf(v2({ type: "Table", columns: [{ header: "X", bind: "/text" }], rowsBind: "/metrics/9/rows" }))).toEqual([
      "root.rowsBind: /metrics/9/rows does not resolve in the data read this turn",
    ]);
    // A Chart binds one metric whose kind its viz can draw.
    expect(errorsOf(v2({ type: "Chart", viz: "stat", bind: "/metrics/1", title: "T" }))).toEqual([
      "root.viz: stat cannot draw a series metric",
    ]);
    expect(errorsOf(v2({ type: "Chart", viz: "line", bind: `/reviews/${JOB_A}/fitScore`, title: "T" }))).toEqual([
      expect.stringContaining("root.bind: a Chart binds one metric"),
    ]);
    // A Table's rows are a list, and each column resolves on its rows.
    expect(errorsOf(v2({ type: "Table", columns: [{ header: "X", bind: "" }], rowsBind: `/jobs/${JOB_A}/title` }))).toEqual([
      expect.stringContaining("root.rowsBind: "),
    ]);
    expect(errorsOf(v2({ type: "Table", columns: [{ header: "X", bind: "/nope" }], rowsBind: `/reviews/${JOB_A}/requirements` }))).toEqual([
      `root.columns.0.bind: /nope resolves on no row of /reviews/${JOB_A}/requirements`,
    ]);
    // A Stat shows one value, not a list.
    expect(errorsOf(v2({ type: "Stat", label: "Reqs", bind: `/reviews/${JOB_A}/requirements` }))).toEqual([
      expect.stringContaining("root.bind: "),
    ]);
  });

  test("bound atoms and button actions name only jobs read this turn", () => {
    expect(errorsOf(v2({ type: "FitScore", jobId: "x:y:404" }))).toEqual(["root.jobId: job x:y:404 was not read this turn"]);
    expect(
      errorsOf(v2({ type: "Button", label: "Compare", variant: "secondary", action: { name: "compare", jobIds: [JOB_A, "x:y:404"] } })),
    ).toEqual(["root.action.jobIds.1: job x:y:404 was not read this turn"]);
  });

  test("a bind into /profile/email or any eeo path fails the pattern or resolves undefined", () => {
    const g = gatheredFixture();
    g.profile = {
      name: "Sam", titles: [], yearsOfExperience: null, education: [], preferredLocations: [], workAuthorized: null,
      needsSponsorship: null,
    };
    // Even if stray fields were present (M6: a real email value), they never resolve.
    const stray = g.profile as unknown as Record<string, unknown>;
    stray.email = "sam@example.test";
    stray.Email = "sam@example.test";
    stray.eeo_gender = "x";
    stray.EEO_race = "x";
    expect(resolveBind(g, "/profile/name")).toBe("Sam");
    const pointers = [
      "/profile/email", "/profile/Email", "/profile/eeo_gender", "/profile/eeo_race", "/profile/EEO_race", "/eeo/gender",
      // I2: percent-encoded forms decode to a denied key and are refused too.
      "/profile/%65eo_gender", "/profile/%45EO_race", "/profile/%65%65%6F_gender", "/profile/%65mail", "/profile/%45mail",
      "/profile", "profile/name", "/profile/../x",
    ];
    for (const pointer of pointers) {
      expect(resolveBind(g, pointer)).toBeUndefined();
      expect(errorsOf(v2({ type: "Stat", label: "X", bind: pointer }), g).length).toBeGreaterThan(0);
    }
    // Keys that only start like the denied ones still resolve.
    stray.emailVerified = true;
    expect(resolveBind(g, "/profile/emailVerified")).toBe(true);
  });

  test("I2: a row bind refuses eeo and email keys, raw or percent-encoded", () => {
    const row = { name: "Sam", email: "sam@example.test", eeo_gender: "x", EEO_race: "x", nested: { eeo_veteran: "x" } };
    expect(resolveRowBind(row, "/name")).toBe("Sam");
    for (const pointer of ["/email", "/%65mail", "/eeo_gender", "/%65eo_gender", "/%45EO_race", "/nested/eeo_veteran", "/nested/%65eo_veteran"]) {
      expect(resolveRowBind(row, pointer)).toBeUndefined();
    }
    // Through the validator: a column bound only to a denied key resolves in no row.
    const g = gatheredFixture();
    const rowsBind = `/reviews/${JOB_A}/requirements`;
    const reqs = resolveBind(g, rowsBind);
    expect(Array.isArray(reqs) && reqs.length > 0).toBe(true);
    (reqs as Record<string, unknown>[])[0].eeo_gender = "x";
    const table = (bind: string) => ({ type: "Table", rowsBind, columns: [{ header: "G", bind }] });
    expect(errorsOf(v2(table("/text")), g)).toEqual([]);
    expect(errorsOf(v2(table("/%65eo_gender")), g).length).toBeGreaterThan(0);
  });

  test("R14: a Table's rowsBind may be the whole /shortlist or /applications list; nothing else may", () => {
    const g = gatheredFixture();
    g.shortlist = [
      {
        jobId: JOB_A, state: "suggested", reasonCode: null, reasonText: null, briefWhy: null, briefRisk: null,
        setBy: "agent", updatedAt: "2026-11-24T00:00:00.000Z", job: g.jobs[JOB_A], fitScore: 80,
      },
    ];
    g.applications = [
      {
        id: "app-1", jobId: JOB_B, stage: "applied", closedReason: null, nextStepOn: null, updatedAt: "2026-11-24T00:00:00.000Z",
        job: g.jobs[JOB_B], events: [], documents: { resume: true, cover: false, outdated: false },
      },
    ];
    const table = (rowsBind: string, bind = "/job/title") => ({ type: "Table", rowsBind, columns: [{ header: "Job", bind }] });
    expect(errorsOf(v2(table("/shortlist")), g)).toEqual([]);
    expect(errorsOf(v2(table("/applications")), g)).toEqual([]);
    expect(errorsOf(v2(table("/applications", "/stage")), g)).toEqual([]);
    expect(resolveRowsBind(g, "/shortlist")).toBe(g.shortlist);
    expect(resolveRowsBind(g, "/applications")).toBe(g.applications);
    // The existing binds still work as rowsBind.
    expect(errorsOf(v2(table(`/reviews/${JOB_A}/requirements`, "/text")), g)).toEqual([]);
    // Only those two lists, and only as a Table's rows.
    for (const pointer of ["/jobs", "/reviews", "/metrics", "/profile", "/memo", "/documents", "/shortlist/", "/Shortlist", "shortlist", "/shortlist/x/y/z/w/v"]) {
      expect(errorsOf(v2(table(pointer)), g).length, pointer).toBeGreaterThan(0);
    }
    expect(resolveRowsBind(g, "/jobs")).toBeUndefined();
    expect(resolveBind(g, "/shortlist")).toBeUndefined();
    expect(errorsOf(v2({ type: "Stat", label: "Shortlist", bind: "/shortlist" }), g).length).toBeGreaterThan(0);
    expect(errorsOf(v2({ type: "Chart", viz: "line", bind: "/applications", title: "Apps" }), g).length).toBeGreaterThan(0);
    // A row bind into a whole-list row still refuses eeo and email keys.
    expect(errorsOf(v2(table("/shortlist", "/job/email")), g).length).toBeGreaterThan(0);
    // An empty list is a valid table (nothing to check its columns against).
    expect(errorsOf(v2(table("/shortlist")), gatheredFixture())).toEqual([]);
  });

  test("resolveBind reads own keys and digit indexes only, and decodes a percent-encoded job id", () => {
    const g = gatheredFixture();
    const workday = "workday:acme:/job/Austin/Engineer_R-1";
    g.jobs[workday] = { ...g.jobs[JOB_A], jobId: workday, title: "Workday role" };
    expect(resolveBind(g, `/jobs/${encodeURIComponent(workday)}/title`)).toBe("Workday role");
    expect(resolveBind(g, `/jobs/${JOB_A}/title`)).toBe("Engineer");
    expect(resolveBind(g, "/metrics/0/n")).toBe(12);
    expect(resolveBind(g, "/metrics/01/n")).toBeUndefined();
    expect(resolveBind(g, "/metrics/length")).toBeUndefined();
    expect(resolveBind(g, "/jobs/constructor")).toBeUndefined();
    expect(resolveBind(g, "/jobs/__proto__/x")).toBeUndefined();
    expect(resolveBind(g, `/jobs/${JOB_A}/title/a/b`)).toBeUndefined();
    expect(resolveBind(emptyGathered(), "/shortlist/0")).toBeUndefined();
  });

  test("heading order 1 then 3 is an a11y error; an unlabeled Field is an error", () => {
    const h = (level: number) => ({ type: "Heading", level, text: `Level ${level}` });
    expect(errorsOf(v2(stack(h(1), h(2), h(3), h(1), h(2))))).toEqual([]);
    expect(errorsOf(v2(stack(h(1), h(3))))).toEqual(["root.children.1: heading level 3 follows level 1; do not skip levels"]);
    expect(errorsOf(v2({ type: "Field", id: "a", label: "   ", kind: "text" })).length).toBeGreaterThan(0);
    expect(errorsOf(v2({ type: "Field", id: "a", kind: "text" })).length).toBeGreaterThan(0);
  });

  test("a Button whose action is not in the enum fails", () => {
    const button = (action: unknown) => v2({ type: "Button", label: "Go", variant: "primary", action });
    expect(errorsOf(button({ name: "answer", questionId: "q1", value: "yes" }))).toEqual([]);
    expect(errorsOf(button({ name: "delete_document", documentId: "d1" }))).toEqual([expect.stringContaining("root.action")]);
    expect(errorsOf(button({ name: "shortlist.set", jobId: JOB_A, state: "shortlisted", extra: 1 })).length).toBeGreaterThan(0);
    expect(errorsOf(button("shortlist")).length).toBeGreaterThan(0);
  });

  test("field ids are unique across the surface", () => {
    const field = { type: "Field", id: "city", label: "City", kind: "text" };
    expect(errorsOf(v2(stack(field, { ...field, label: "Other city" })))).toEqual([
      "root.children.1.id: field id city is used twice",
    ]);
  });

  test("the payload envelope is strict: variant 2, an optional plain title, one root", () => {
    expect(errorsOf(v2(text(), { title: "t".repeat(81) })).length).toBeGreaterThan(0);
    expect(errorsOf({ variant: 1, root: text() }).length).toBeGreaterThan(0);
    expect(errorsOf({ variant: 2, root: text(), html: "<b>x</b>" }).length).toBeGreaterThan(0);
    expect(errorsOf({ variant: 2 }).length).toBeGreaterThan(0);
    expect(errorsOf("just text").length).toBeGreaterThan(0);
    expect(errorsOf(null).length).toBeGreaterThan(0);
  });

  test("errors are plain strings under 200 chars each", () => {
    const longId = `greenhouse:acme:${"9".repeat(250)}`;
    const payloads = [
      v2(stack(...Array.from({ length: 30 }, () => ({ type: "Stat", label: "x", bind: `/jobs/${"a".repeat(60)}/title` })))),
      v2({ type: "JobTitle", jobId: longId }),
      v2({ type: "Stat", label: "x", bind: "/nowhere/at/all" }),
      v2(text("x".repeat(1000))),
      v2(nested(9)),
      { variant: 2, root: { type: "Nope" } },
    ];
    for (const p of payloads) {
      const errors = errorsOf(p);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.length).toBeLessThanOrEqual(20);
      for (const e of errors) {
        expect(typeof e).toBe("string");
        expect(e.length).toBeLessThan(200);
        expect(e).not.toContain("\n");
      }
    }
  });
});
