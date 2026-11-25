// The golden-scenario asserts (plan Task 1.22) over hand-written recordings. Each
// negative test takes a committed recording that passes and breaks one thing in it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { assertRecording, BLOCK_INTENTS, CONFIRMATION_TOOLS, type AssertCode } from "@/lib/agent/evals/asserts";
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
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.test\.tsx?$/.test(name) && /evals\/harness["']/.test(readFileSync(full, "utf8"))) offenders.push(full);
      }
    };
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
