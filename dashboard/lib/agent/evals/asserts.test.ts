// The golden-scenario asserts (plan Task 1.22) over hand-written recordings. Each
// negative test takes a committed recording that passes and breaks one thing in it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { assertRecording, BLOCK_INTENTS, CONFIRMATION_TOOLS, findMisstatements, type AssertCode } from "@/lib/agent/evals/asserts";
import { emptyGathered, type GatheredData } from "@/lib/agent/gathered";
import { parseRecording, recordingFileName, type Recording } from "@/lib/agent/evals/recording";
import { PERSONAS, PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIOS, SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import { V1_BLOCK_TYPES } from "@/lib/agent/surfaces/v1/blocks";
import { INTENT_NAMES } from "@/lib/agent/actions/intents";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { parseProfileText } from "@/lib/rolefit/parseProfile";
import { resumeChecks } from "@/lib/rolefit/resumeChecks";

const V1_DIR = fileURLToPath(new URL("./recordings/v1/", import.meta.url));
const DASHBOARD_DIR = fileURLToPath(new URL("../../../", import.meta.url));

function recordingFiles(): string[] {
  return readdirSync(V1_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function load(file: string): Recording {
  const r = parseRecording(JSON.parse(readFileSync(path.join(V1_DIR, file), "utf8")));
  if (!r) throw new Error(`${file} does not parse as a recording`);
  return r;
}

/** A fresh copy of the committed hand-written recording of one scenario. */
function committed(scenario: Recording["scenario"]): Recording {
  const file = recordingFiles().find((f) => f.startsWith(`${scenario}.`) && f.endsWith(".handwritten.json"));
  if (!file) throw new Error(`no hand-written recording of ${scenario}`);
  return structuredClone(load(file));
}

const codes = (r: Recording): AssertCode[] => assertRecording(r).map((f) => f.code);

/** The gathered data of surface `i`, as a mutable object (the recording's own copy). */
function gathered(r: Recording, i: number): Record<string, Record<string, Record<string, unknown>>> {
  return r.surfaces[i].gathered as Record<string, Record<string, Record<string, unknown>>>;
}

describe("assertRecording", () => {
  test("flags a surface whose shown fit differs from the review row", () => {
    const r = committed("b_compare");
    gathered(r, 0).reviews["greenhouse:eval-sb-0:1000"].fitScore = 99;
    const failures = assertRecording(r);
    expect(failures.map((f) => f.code)).toEqual(["fit_mismatch"]);
    expect(failures[0].message).toContain("greenhouse:eval-sb-0:1000");
    expect(failures[0].path).toBe("surfaces[0].gathered.reviews[greenhouse:eval-sb-0:1000]");
  });

  test("flags a shown title, company or pay that differs from the database", () => {
    const r = committed("b_compare");
    gathered(r, 0).jobs["greenhouse:eval-sb-1:1001"].title = "Principal Engineer";
    gathered(r, 0).jobs["greenhouse:eval-sb-1:1001"].company = "Another Example Co";
    gathered(r, 0).reviews["greenhouse:eval-sb-1:1001"].payMax = 250000;
    expect(codes(r).sort()).toEqual(["company_mismatch", "pay_mismatch", "title_mismatch"]);
  });

  test("flags a posting link that is not the stored URL, and any other link in a payload", () => {
    const r = committed("b_compare");
    gathered(r, 0).jobs["greenhouse:eval-sb-0:1000"].url = "https://jobs.example.test/somewhere-else";
    const blocks = r.surfaces[1].payload.blocks as Array<Record<string, unknown>>;
    blocks[1].text = "Apply at https://apply.example.test/now before it closes.";
    expect(codes(r).sort()).toEqual(["link_in_text", "link_mismatch"]);
  });

  test("flags a block that shows a job missing from the database", () => {
    const r = committed("d_weekly");
    r.dbAfter.jobs = r.dbAfter.jobs.filter((j) => j.jobId !== "greenhouse:eval-ng-4:1010");
    r.dbBefore.jobs = r.dbBefore.jobs.filter((j) => j.jobId !== "greenhouse:eval-ng-4:1010");
    expect(codes(r)).toContain("job_not_in_database");
  });

  test("flags start_application_prep without a preceding approval", () => {
    const noDecision = committed("c_prep");
    noDecision.approvals = [];
    expect(codes(noDecision)).toEqual(["unapproved_tool"]);

    const noApproval = committed("c_prep");
    const call = noApproval.toolCalls.find((c) => c.name === "start_application_prep");
    if (!call) throw new Error("no prep call");
    call.approval = null;
    expect(codes(noApproval)).toEqual(["unapproved_tool"]);

    const denied = committed("c_prep");
    denied.approvals = [{ approvalId: "aprv-c-1", approved: false }];
    expect(codes(denied)).toEqual(["unapproved_tool"]);
  });

  test("a confirmation tool that is still waiting or was denied is not a failure", () => {
    const r = committed("c_prep");
    const call = r.toolCalls.find((c) => c.name === "start_application_prep");
    if (!call) throw new Error("no prep call");
    call.state = "pending";
    call.approval = { id: "aprv-c-1", approved: null };
    r.approvals = [];
    r.dbAfter.packages = [];
    expect(codes(r)).toEqual([]);
  });

  test("flags a memo version created without a proposal", () => {
    const byUser = committed("b_compare");
    byUser.dbAfter.memoVersion = 2;
    byUser.dbAfter.memoVersions.push({ version: 2, changedBy: "user", proposalId: null });
    expect(codes(byUser)).toEqual(["memo_changed_without_proposal"]);

    // A proposal the user never approved on a surface.
    const unpressed = committed("a_resume_upload");
    unpressed.intents = [];
    expect(codes(unpressed)).toEqual(["memo_changed_without_proposal"]);

    // The memo moved with no version row at all.
    const silent = committed("b_compare");
    silent.dbAfter.memoVersion = 3;
    expect(codes(silent)).toEqual(["memo_changed_without_proposal"]);
  });

  test("flags an action with no handler", () => {
    const pressed = committed("d_weekly");
    pressed.intents.push({
      surfaceId: pressed.surfaces[0].id,
      intent: { name: "application.withdraw", jobId: "greenhouse:eval-ng-4:1010" },
      outcome: "dropped",
    });
    expect(codes(pressed)).toEqual(["unhandled_action"]);

    // A button inside a payload (the variant 2 shape) naming an unknown intent.
    const nested = committed("d_weekly");
    nested.surfaces[0].variant = 2;
    nested.surfaces[0].payload = {
      variant: 2,
      root: { type: "Button", label: "Withdraw", action: { name: "application.withdraw", jobId: "greenhouse:eval-ng-4:1010" } },
    };
    nested.surfaces[0].fallbackPayload = null;
    expect(codes(nested)).toContain("unhandled_action");
  });

  test("flags a payload that fails the variant 1 grammar or names an unknown block", () => {
    const r = committed("b_compare");
    r.surfaces[1].payload = { variant: 1, blocks: [{ type: "IframeEmbed", src: "x" }] };
    expect(codes(r).sort()).toEqual(["surface_invalid", "unknown_block"]);
  });

  test("flags a tailored résumé that fails resumeChecks", () => {
    const r = committed("c_prep");
    const resume = r.dbAfter.packages[0].resume as { experience: Array<{ bullets: string[] }>; skills: string[] };
    resume.experience[1].bullets[0] = "Built a lab curriculum adopted by three other schools.";
    resume.skills = resume.skills.slice(0, 5);
    const failures = assertRecording(r);
    expect(failures.map((f) => f.code)).toEqual(["resume_checks_failed"]);
    expect(failures[0].message).toContain("skills_count");
    expect(failures[0].message).toContain("verb_repeat");
  });

  test("flags scenario (a) ending with an empty shortlist", () => {
    const r = committed("a_resume_upload");
    r.dbAfter.shortlist = [];
    expect(codes(r)).toEqual(["scenario_a_no_shortlist"]);
  });

  test("flags scenario (d) with no metric shown, or a rate shown below its minimum n", () => {
    const none = committed("d_weekly");
    none.surfaces[0].payload = { variant: 1, blocks: [{ type: "StaleList", limit: 5 }] };
    expect(codes(none)).toEqual(["scenario_d_no_metrics"]);

    const thin = committed("d_weekly");
    const metrics = gathered(thin, 0).metrics as unknown as Array<Record<string, unknown>>;
    metrics[1].n = 3;
    expect(codes(thin)).toEqual(["rate_below_min_n"]);

    const missing = committed("d_weekly");
    const blocks = missing.surfaces[0].payload.blocks as Array<Record<string, unknown>>;
    blocks[0].metricRefs = [7];
    expect(codes(missing)).toContain("metric_not_gathered");
  });

  // Spec 08 S15.2: a turn stores at most 3 surfaces, counted per run (the surfaces' runId).
  test("flags a run that stored more than 3 surfaces, and names the run", () => {
    const r = committed("b_compare");
    const run = r.surfaces[0].runId!;
    const view = (i: number) => ({ ...structuredClone(r.surfaces[0]), id: `5f000000-0000-4000-8000-0000000000c${i}`, runId: run });
    r.surfaces = [view(1), view(2), view(3)];
    expect(codes(r)).toEqual([]);
    r.surfaces.push(view(4));
    const failures = assertRecording(r);
    expect(failures.map((f) => f.code)).toEqual(["too_many_views"]);
    expect(failures[0].message).toBe(`run ${run} stored 4 views; a turn may store at most 3`);
    expect(failures[0].path).toBe("surfaces");
  });

  test("counts views per run: four surfaces over two runs pass, and a surface with no run is not counted", () => {
    const r = committed("b_compare");
    const view = (i: number, runId: string | null) => ({ ...structuredClone(r.surfaces[0]), id: `5f000000-0000-4000-8000-0000000000d${i}`, runId });
    const [a, b] = [r.surfaces[0].runId, r.surfaces[1].runId];
    r.surfaces = [view(1, a), view(2, a), view(3, b), view(4, b), view(5, null), view(6, null), view(7, null), view(8, null)];
    expect(codes(r)).toEqual([]);
  });

  test("checks every view of a turn against the database, not only the last", () => {
    const r = committed("b_compare");
    // One turn with two views of the same jobs.
    r.surfaces = [r.surfaces[0], { ...structuredClone(r.surfaces[0]), id: "5f000000-0000-4000-8000-0000000000e1" }];
    gathered(r, 0).reviews["greenhouse:eval-sb-0:1000"].fitScore = 99;
    gathered(r, 1).jobs["greenhouse:eval-sb-1:1001"].title = "Principal Engineer";
    const failures = assertRecording(r);
    expect(failures.map((f) => [f.code, f.path])).toEqual([
      ["fit_mismatch", "surfaces[0].gathered.reviews[greenhouse:eval-sb-0:1000]"],
      ["title_mismatch", expect.stringMatching(/^surfaces\[1\]\.gathered\.jobs/)],
    ]);
  });

  test("passes the committed variant 1 recordings", () => {
    const files = recordingFiles();
    // Never vacuous: every scenario has at least one committed recording.
    expect(files.length).toBeGreaterThanOrEqual(SCENARIO_IDS.length);
    const seen = new Set<string>();
    for (const file of files) {
      const r = load(file);
      expect(r.variant, file).toBe(1);
      expect(assertRecording(r), file).toEqual([]);
      seen.add(r.scenario);
    }
    expect([...seen].sort()).toEqual([...SCENARIO_IDS].sort());
  });
});

describe("assertRecording on variants 2 and 3 (Task 2.10)", () => {
  /** The d_weekly recording with its one surface re-rendered as `payload` in `variant`. */
  function asVariant(variant: 2 | 3, payload: Record<string, unknown>): Recording {
    const r = committed("d_weekly");
    r.variant = variant;
    r.source = "rerender";
    r.surfaces[0] = { ...r.surfaces[0], variant, payload, fallbackPayload: r.surfaces[0].payload };
    return r;
  }
  const weeklyTree = (bind: string) => ({
    variant: 2,
    root: {
      type: "Stack",
      gap: "2",
      children: [
        { type: "Heading", level: 2, text: "Your last few weeks" },
        { type: "Stat", label: "Response rate", bind },
        { type: "JobTitle", jobId: "greenhouse:eval-ng-4:1010" },
      ],
    },
  });

  test("a variant 2 tree's Stat binds count as shown metrics; with none, scenario (d) fails", () => {
    expect(codes(asVariant(2, weeklyTree("/metrics/1")))).toEqual([]);
    expect(codes(asVariant(2, weeklyTree("/metrics/7")))).toContain("metric_not_gathered");
    const noMetric = weeklyTree("/metrics/1");
    noMetric.root.children.splice(1, 1);
    expect(codes(asVariant(2, noMetric))).toEqual(["scenario_d_no_metrics"]);
    const thin = asVariant(2, weeklyTree("/metrics/1"));
    (gathered(thin, 0).metrics as unknown as Array<Record<string, unknown>>)[1].n = 3;
    expect(codes(thin)).toEqual(["rate_below_min_n"]);
  });

  test("a variant 2 tree that fails its grammar, or names a job not stored, fails", () => {
    expect(codes(asVariant(2, { variant: 2, root: { type: "Nope" } }))).toEqual(["surface_invalid", "scenario_d_no_metrics"]);
    const unknownJob = weeklyTree("/metrics/1");
    (unknownJob.root.children[2] as { jobId: string }).jobId = "greenhouse:eval-ng-9:9999";
    expect(codes(asVariant(2, unknownJob))).toContain("job_not_in_database");
  });

  test("a variant 3 document counts as showing metrics when it reads them, and its stored fallback is checked as variant 1", () => {
    const reads = asVariant(3, { variant: 3, title: "Weekly", html: "<p id=a></p><script>host.onInit(function (d) { a.textContent = d.metrics.length; });</script>" });
    expect(codes(reads)).toEqual([]);
    const blind = asVariant(3, { variant: 3, title: "Weekly", html: "<p>Nothing here</p>" });
    expect(codes(blind)).toEqual(["scenario_d_no_metrics"]);
    const badFallback = asVariant(3, { variant: 3, title: "Weekly", html: "<p>metrics</p>" });
    badFallback.surfaces[0].fallbackPayload = { variant: 1, blocks: [{ type: "Bogus" }] };
    expect(codes(badFallback)).toEqual(["unknown_block", "surface_invalid"]);
  });

  test("a variant 2 surface stored as its variant 1 fallback is checked as variant 1", () => {
    const r = committed("d_weekly");
    r.variant = 2;
    r.surfaces[0] = { ...r.surfaces[0], variant: 2, outcome: "fallback", fallbackPayload: r.surfaces[0].payload };
    expect(codes(r)).toEqual([]);
  });
});

describe("findMisstatements (Task 2.11, variant 3 frame text)", () => {
  const job = (jobId: string, title: string, company: string) => ({
    jobId,
    title,
    company,
    location: null,
    remote: true,
    url: `https://jobs.example/${jobId.replace(/:/g, "/")}`,
    firstSeenAt: "2026-11-01T00:00:00.000Z",
    ageDays: 3,
    closed: false,
  });
  const review = (jobId: string, fitScore: number | null, payMin: number | null, payMax: number | null) => ({
    jobId,
    verdict: "approve" as const,
    fitScore,
    skillsScore: null,
    experienceScore: null,
    compScore: null,
    payMin,
    payMax,
    payCurrency: payMin === null ? null : "USD",
    payPeriod: payMin === null ? null : "year",
    workArrangement: null,
    seniority: null,
    redFlags: [],
    skillGaps: [],
    requirements: [],
    reasoning: null,
    stale: false,
  });
  const gathered: GatheredData = {
    ...emptyGathered(),
    jobs: {
      "greenhouse:acme:1": job("greenhouse:acme:1", "Senior Backend Engineer", "Acme"),
      "lever:globex:2": job("lever:globex:2", "Backend Engineer", "Globex"),
      "ashby:initech:3": job("ashby:initech:3", "Data Analyst", "Initech"),
    },
    reviews: {
      "greenhouse:acme:1": review("greenhouse:acme:1", 82, 145_000, 170_000),
      "lever:globex:2": review("lever:globex:2", 64, 120_000, 135_000),
      "ashby:initech:3": review("ashby:initech:3", null, null, null),
    },
  };
  const codes = (text: string) => findMisstatements(text, gathered).map((f) => f.code);

  test("figures that equal each job's stored values pass, in the formats a page writes them", () => {
    const text = [
      "Your top matches",
      "Senior Backend Engineer",
      "Acme · Remote",
      "Fit 82 · $145k – $170k",
      "Backend Engineer",
      "Globex",
      "64% fit · USD 120,000",
    ].join("\n");
    expect(findMisstatements(text, gathered)).toEqual([]);
    expect(codes("Senior Backend Engineer\nfit score: 82/100\n$145,000 - $170,000 a year")).toEqual([]);
    expect(codes("Senior Backend Engineer pays 145k to 170k (fit 82)")).toEqual([]);
  });

  test("a fit or pay figure that differs from the stored value is a misstatement", () => {
    expect(codes("Senior Backend Engineer\nFit 88\n$145k")).toEqual(["fit_mismatch"]);
    expect(codes("Senior Backend Engineer\nFit 82\n$150k – $170k")).toEqual(["pay_mismatch"]);
    const [f] = findMisstatements("Backend Engineer · 82% match", gathered);
    expect(f).toMatchObject({ code: "fit_mismatch", path: "frame" });
    expect(f.message).toContain("lever:globex:2");
  });

  test("figures belong to the nearest title before them; the longest title wins where titles overlap", () => {
    // Acme's 82 under "Senior Backend Engineer" is right; the same 82 under Globex's title is not.
    expect(codes("Senior Backend Engineer Fit 82\nBackend Engineer Fit 82")).toEqual(["fit_mismatch"]);
    expect(codes("Backend Engineer Fit 64\nSenior Backend Engineer Fit 82")).toEqual([]);
  });

  test("a figure for a job with no stored value, or before any title that matches no job, is a misstatement", () => {
    expect(codes("Data Analyst\nFit 70")).toEqual(["fit_mismatch"]);
    expect(codes("Data Analyst\n$90k")).toEqual(["pay_mismatch"]);
    expect(codes("Your best match is 82% fit.")).toEqual([]);
    expect(codes("Your best match is 97% fit, paying $300k.")).toEqual(["fit_mismatch", "pay_mismatch"]);
  });

  test("401k and a figure followed by what it counts are not pay; pay words and the next piece of the layout keep it pay (M6)", () => {
    expect(codes("Senior Backend Engineer\nFit 82 · 401k match · 401 k plan")).toEqual([]);
    expect(codes("Senior Backend Engineer\nAcme serves 150k users, raised $20 million and $5M ARR")).toEqual([]);
    expect(codes("Senior Backend Engineer\n$145k base salary, up to $170k a year")).toEqual([]);
    // Still read as pay, and wrong: a pay word after it, a capitalised next item, or nothing after it.
    expect(codes("Senior Backend Engineer\n$150k base")).toEqual(["pay_mismatch"]);
    expect(codes("Senior Backend Engineer\n$150k Remote")).toEqual(["pay_mismatch"]);
    expect(codes("Senior Backend Engineer\n$401k")).toEqual(["pay_mismatch"]);
    expect(codes("Senior Backend Engineer\n150k.")).toEqual(["pay_mismatch"]);
  });

  test("in a table a figure is checked against every job the table names; a table that names none uses the nearest title (M6)", () => {
    const table = (rows: string[][]) => rows.map((r) => r.join("\t")).join("\n");
    const compare = table([
      ["", "Senior Backend Engineer", "Backend Engineer"],
      ["Fit", "82", "64"],
      ["Pay", "$145k – $170k", "$120k – $135k"],
    ]);
    // Read by nearest title, Acme's 82 and $145k would sit under Globex's "Backend Engineer".
    expect(codes(`Side by side\n${compare}\nPick one`)).toEqual([]);
    const wrong = table([
      ["", "Senior Backend Engineer", "Backend Engineer"],
      ["Pay", "$150k", "$120k"],
    ]);
    const [f, ...rest] = findMisstatements(wrong, gathered);
    expect(rest).toEqual([]);
    expect(f).toMatchObject({ code: "pay_mismatch" });
    expect(f.message).toContain("a job in its table (greenhouse:acme:1, lever:globex:2)");
    // A job named outside the table does not widen it.
    expect(codes(`Senior Backend Engineer\n${table([["Backend Engineer", "Fit 82"]])}`)).toEqual(["fit_mismatch"]);
    // A table with no job title in it: the nearest title before it owns its figures.
    expect(codes(`Backend Engineer\n${table([["Fit", "64"], ["Pay", "$120k"]])}`)).toEqual([]);
    expect(codes(`Backend Engineer\n${table([["Fit", "82"]])}`)).toEqual(["fit_mismatch"]);
  });

  test("plain numbers, counts and dates are not figures", () => {
    expect(codes("Senior Backend Engineer\n3 requirements met of 5, posted 12 days ago, 2026-11-20, 1,200 applicants")).toEqual([]);
  });
});

describe("the committed recordings and personas", () => {
  test("every recording file is named for its scenario, persona and source", () => {
    for (const file of recordingFiles()) expect(recordingFileName(load(file)), file).toBe(file);
  });

  test("hand-written recordings use their persona's own jobs, reviews and résumé", () => {
    for (const file of recordingFiles().filter((f) => f.endsWith(".handwritten.json"))) {
      const r = load(file);
      const persona = PERSONAS[r.persona];
      const jobs = new Map(persona.jobs.map((j) => [j.jobId, j]));
      for (const snap of [r.dbBefore, r.dbAfter]) {
        for (const j of snap.jobs) {
          expect(jobs.get(j.jobId), `${file} ${j.jobId}`).toMatchObject({ title: j.title, companyName: j.company, url: j.url });
        }
        for (const v of snap.reviews) {
          expect(jobs.get(v.jobId), `${file} ${v.jobId}`).toMatchObject({ fitScore: v.fitScore, payMin: v.payMin, payMax: v.payMax });
        }
        if (snap.resumeText !== null) expect(snap.resumeText, file).toBe(persona.resumeText.trim());
      }
    }
  });

  test("each persona is synthetic: 30 jobs with valid ids, example.test links and addresses", () => {
    expect(Object.keys(PERSONAS).sort()).toEqual([...PERSONA_IDS].sort());
    const allIds = new Set<string>();
    for (const p of Object.values(PERSONAS)) {
      expect(p.jobs).toHaveLength(30);
      expect(p.email).toMatch(/@example\.test$/);
      expect(p.resumeText).not.toMatch(/https?:\/\//);
      for (const j of p.jobs) {
        expect(j.jobId).toMatch(JOB_ID_RE);
        expect(j.url.startsWith("https://jobs.example.test/")).toBe(true);
        expect(j.companyName).toMatch(/Example|Sample|Placeholder|Mock|Fictional|Imaginary/);
        allIds.add(j.jobId);
      }
    }
    expect(allIds.size).toBe(90);
  });

  test("each persona's tailored résumé passes resumeChecks against its résumé", () => {
    for (const p of Object.values(PERSONAS)) {
      const checks = resumeChecks(p.tailoredResume, parseProfileText(p.resumeText.trim()));
      expect(checks.checks.filter((c) => !c.pass), p.id).toEqual([]);
    }
  });

  test("every approval a scenario sends names a confirmation tool", () => {
    for (const s of Object.values(SCENARIOS)) {
      for (const step of s.steps) {
        if (step.kind === "approve") expect(CONFIRMATION_TOOLS).toContain(step.tool);
      }
    }
  });

  test("BLOCK_INTENTS covers exactly the 13 block types, with registered intents only", () => {
    expect(Object.keys(BLOCK_INTENTS).sort()).toEqual([...V1_BLOCK_TYPES].sort());
    for (const names of Object.values(BLOCK_INTENTS)) {
      for (const name of names) expect(INTENT_NAMES).toContain(name);
    }
  });

  test("no test imports the live harness (it never runs in CI)", () => {
    const harness = path.join(DASHBOARD_DIR, "lib/agent/evals/harness");
    // Every module specifier (static, dynamic, vi.mock or require), resolved from the
    // file's folder or the @/ root, with the extension dropped.
    const importsHarness = (file: string, text: string): boolean => {
      const specs = [...text.matchAll(/(?:from|import|mock|require)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
      return specs.some((spec) => {
        const base = spec.startsWith("@/")
          ? path.join(DASHBOARD_DIR, spec.slice(2))
          : spec.startsWith(".")
            ? path.resolve(path.dirname(file), spec)
            : null;
        return base !== null && base.replace(/\.(ts|tsx|js|mjs)$/, "") === harness;
      });
    };
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.test\.tsx?$/.test(name) && importsHarness(full, readFileSync(full, "utf8"))) offenders.push(full);
      }
    };
    // The check itself catches every spelling, a relative one beside harness.ts included.
    const beside = path.join(DASHBOARD_DIR, "lib/agent/evals/stray.test.ts");
    const elsewhere = path.join(DASHBOARD_DIR, "lib/agent/stray.test.ts");
    // Built at run time so this file's own text holds no harness specifier.
    const fromLine = (spec: string) => ["import { runScenario } from", JSON.stringify(spec)].join(" ");
    const dynamicLine = (spec: string) => `const h = await import('${spec}');`;
    const mockLine = (spec: string) => `vi.mock(${JSON.stringify(spec)}, () => ({}));`;
    const h = "harness";
    expect(importsHarness(beside, fromLine(`./${h}`))).toBe(true);
    expect(importsHarness(beside, dynamicLine(`./${h}.ts`))).toBe(true);
    expect(importsHarness(elsewhere, fromLine(`./evals/${h}`))).toBe(true);
    expect(importsHarness(elsewhere, mockLine(`@/lib/agent/evals/${h}`))).toBe(true);
    expect(importsHarness(beside, fromLine("./asserts"))).toBe(false);
    expect(importsHarness(elsewhere, fromLine(`./${h}`))).toBe(false);
    for (const top of ["lib", "app", "components", "tests"]) {
      const dir = path.join(DASHBOARD_DIR, top);
      try {
        if (statSync(dir).isDirectory()) walk(dir);
      } catch {
        // A top-level folder this checkout does not have.
      }
    }
    expect(offenders).toEqual([]);
  });
});
