// @vitest-environment jsdom
// The variant 1 blocks (plan Tasks 1.18 and 1.19). Every bound field comes from the
// turn's gathered data (or a database row the block is given), agent text renders as
// plain text, and every press emits one intent that passes the closed enum.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ActionIntentSchema, ANSWER_MAX, type ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import { SurfacePayloadV1Schema, type SurfacePayloadV1, type V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { JOB_A, JOB_B, SERIES_METRIC, VALUE_METRIC, gatheredFixture, jobFacts, reviewFacts } from "@/lib/agent/surfaces/v1/testFixtures";
import { composeCoverLetterText } from "@/lib/rolefit/coverLetterText";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import { TileSpecSchema } from "@/lib/workspaces/analyticsTiles";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import type { MemoProposal } from "@/lib/workspaces/types";
import {
  AgentBlocksJobsFixture,
  AgentBlocksPrepFixture,
  FIXTURE_GATHERED,
  JOBS_FIXTURE_PAYLOAD,
  PREP_FIXTURE_GATHERED,
  PREP_FIXTURE_PAYLOAD,
} from "./AgentBlocksFixture";
import { BlockList } from "./BlockList";
import { COMPARISON_ROW_LABELS } from "./JobComparisonBlock";
import { INTAKE_ANSWER_MAX } from "./IntakeQuestionsBlock";
import { MEMO_GONE_TEXT } from "./MemoDiffBlock";
import { METRIC_GONE_TEXT } from "./metricLabels";
import { pinTile } from "./MetricChartBlock";
import { PREP_POLL_MS } from "./PrepChecklistBlock";
import { NO_PROFILE_TEXT } from "./ProfileReadbackBlock";
import { NO_APPLICATIONS_TEXT } from "./StaleListBlock";
import { UNAVAILABLE_TEXT, type BlockRows, type PackageView } from "./types";

afterEach(cleanup);

const MISSING = "greenhouse:nowhere:999";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000b1";

function gathered(): GatheredData {
  const g = gatheredFixture();
  g.jobs[JOB_A] = { ...jobFacts(JOB_A), title: "Staff Platform Engineer", company: "Acme Systems", url: "https://jobs.example.com/acme/101" };
  g.jobs[JOB_B] = { ...jobFacts(JOB_B), title: "Backend Engineer", company: "Globex", url: "https://jobs.example.com/globex/202", remote: false, location: "Austin, TX" };
  g.reviews[JOB_A] = { ...reviewFacts(JOB_A, 3), fitScore: 87, payMin: 180000, payMax: 210000, payCurrency: "USD", payPeriod: "year", redFlags: ["On-call every other week"] };
  g.reviews[JOB_B] = { ...reviewFacts(JOB_B, 2), fitScore: 64, workArrangement: "onsite" };
  return g;
}

function payload(...blocks: V1Block[]): SurfacePayloadV1 {
  // Every payload a test renders is one the grammar accepts.
  return SurfacePayloadV1Schema.parse({ variant: 1, blocks });
}

function renderBlocks(blocks: V1Block[], g: GatheredData = gathered(), rows?: BlockRows) {
  const onIntent = vi.fn<(intent: ActionIntent) => void>();
  const view = render(<BlockList payload={payload(...blocks)} gathered={g} onIntent={onIntent} rows={rows} />);
  return { ...view, onIntent };
}

/** Every intent the block emitted, each checked against the closed enum. */
function emitted(onIntent: ReturnType<typeof vi.fn>): ActionIntent[] {
  return onIntent.mock.calls.map(([intent]) => {
    expect(ActionIntentSchema.safeParse(intent).success).toBe(true);
    return intent as ActionIntent;
  });
}

describe("job blocks", () => {
  test("JobCard shows title, company, fit and pay from gathered data, not from the payload", () => {
    renderBlocks([{ type: "JobCard", jobId: JOB_A, note: "Principal Wizard at Initech pays $900k with 99 fit." }]);
    expect(screen.getByRole("link", { name: "Staff Platform Engineer" })).toBeTruthy();
    expect(screen.getByText("Acme Systems")).toBeTruthy();
    expect(screen.getByText("87 fit")).toBeTruthy();
    expect(screen.getByText("$180k–210k")).toBeTruthy();
    // The note is shown only as the agent's own sentence, never as a bound field.
    expect(screen.queryByRole("link", { name: /Principal Wizard/ })).toBeNull();
    expect(screen.queryByText("99 fit")).toBeNull();
    expect(screen.getByText("Principal Wizard at Initech pays $900k with 99 fit.").tagName).toBe("P");
  });

  test("a job missing from gathered data renders the unavailable line and no buttons", () => {
    const { container } = renderBlocks([
      { type: "JobCard", jobId: MISSING },
      { type: "JobComparison", jobIds: [JOB_A, MISSING], rowOrder: ["pay"], verdict: "Pick A." },
      { type: "ShortlistQueue", jobIds: [MISSING] },
    ]);
    expect(screen.getAllByText(UNAVAILABLE_TEXT)).toHaveLength(3);
    // The queue keeps its fixed Compare control (disabled); no job has a button.
    const buttons = screen.queryAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Compare selected"]);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  test("JobComparison renders rows in the agent's rowOrder with fixed column headers", () => {
    const rowOrder = ["red_flags", "pay", "age", "requirements"] as const;
    renderBlocks([{ type: "JobComparison", jobIds: [JOB_A, JOB_B], rowOrder: [...rowOrder], verdict: "Acme pays more." }]);
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual(["What matters", "Staff Platform EngineerAcme Systems", "Backend EngineerGlobex"]);
    const rowHeaders = within(table).getAllByRole("rowheader").map((th) => th.textContent);
    expect(rowHeaders).toEqual(rowOrder.map((r) => COMPARISON_ROW_LABELS[r]));
    const payRow = within(table).getByRole("rowheader", { name: "Pay" }).closest("tr")!;
    expect(within(payRow).getAllByRole("cell").map((td) => td.textContent)).toEqual(["$180k–210k", "Not listed"]);
    expect(screen.getByText("Acme pays more.")).toBeTruthy();
  });

  test("comparison actions emit shortlist.set, application.prepare and compare intents only", () => {
    const { onIntent } = renderBlocks([
      { type: "JobComparison", jobIds: [JOB_A, JOB_B], rowOrder: ["pay"], verdict: "Either." },
      { type: "ShortlistQueue", jobIds: [JOB_A, JOB_B] },
    ]);
    const press = (name: string) => screen.getAllByRole("button", { name }).forEach((b) => fireEvent.click(b));
    press("Shortlist");
    press("Later");
    press("Prepare application");
    press("Select to compare");
    fireEvent.click(screen.getByRole("button", { name: "Compare selected" }));
    // Skip asks for the user's reason first, then sends it with the skip.
    fireEvent.click(screen.getAllByRole("button", { name: "Skip" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Pay" }));

    const intents = emitted(onIntent);
    expect(new Set(intents.map((i) => i.name))).toEqual(new Set(["shortlist.set", "application.prepare", "compare"]));
    expect(intents).toContainEqual({ name: "compare", jobIds: [JOB_A, JOB_B] });
    expect(intents).toContainEqual({ name: "application.prepare", jobId: JOB_B });
    expect(intents).toContainEqual({ name: "shortlist.set", jobId: JOB_A, state: "skipped", reasonCode: "pay" });
    expect(intents.filter((i) => i.name === "shortlist.set" && i.state === "shortlisted")).toHaveLength(4);
  });

  test("the posting link href is gathered.jobs[id].url", () => {
    renderBlocks([{ type: "JobCard", jobId: JOB_A }, { type: "ShortlistQueue", jobIds: [JOB_B] }]);
    expect(screen.getByRole("link", { name: "Staff Platform Engineer" }).getAttribute("href")).toBe("https://jobs.example.com/acme/101");
    expect(screen.getByRole("link", { name: "Backend Engineer" }).getAttribute("href")).toBe("https://jobs.example.com/globex/202");
  });

  test("a non-http posting url renders the title as text, not a link", () => {
    const g = gathered();
    g.jobs[JOB_A] = { ...g.jobs[JOB_A], url: "javascript:alert(1)" };
    renderBlocks([{ type: "JobCard", jobId: JOB_A }], g);
    expect(screen.getByText("Staff Platform Engineer").tagName).toBe("SPAN");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("agent text", () => {
  test("agent text containing HTML or a URL renders as literal text with no anchor", () => {
    const hostile = '<a href="https://evil.example">claim</a> <img src=x onerror=alert(1)> see https://evil.example/x';
    const { container } = renderBlocks([
      { type: "Callout", tone: "warning", text: hostile },
      { type: "JobCard", jobId: JOB_A, note: hostile },
      { type: "JobComparison", jobIds: [JOB_A, JOB_B], rowOrder: ["pay"], verdict: hostile },
      { type: "ProfileReadback", note: hostile },
    ]);
    expect(screen.getAllByText(hostile)).toHaveLength(4);
    expect(container.querySelector("img")).toBeNull();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h?.includes("evil"))).toBe(false);
    expect(container.innerHTML).toContain("&lt;a href=");
  });
});

describe("intake", () => {
  test("IntakeQuestions submit emits one answer intent per question", () => {
    const { onIntent } = renderBlocks([
      {
        type: "IntakeQuestions",
        questions: [
          { id: "floor", label: "What is your pay floor?", kind: "text" },
          { id: "where", label: "Where can you work?", kind: "locations" },
          { id: "level", label: "Which level?", kind: "choice", options: ["Senior", "Staff"] },
          { id: "breakers", label: "Any deal-breakers?", kind: "multi", options: ["On-call", "Relocation", "Travel"] },
        ],
      },
    ]);
    const send = screen.getByRole("button", { name: "Send answers" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("What is your pay floor?"), { target: { value: " $180k base " } });
    fireEvent.change(screen.getByLabelText("Where can you work?"), { target: { value: "Remote US\n\nAustin, TX\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Staff" }));
    fireEvent.click(screen.getByRole("button", { name: "On-call" }));
    fireEvent.click(screen.getByRole("button", { name: "Travel" }));
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    expect(emitted(onIntent)).toEqual([
      { name: "answer", questionId: "floor", value: "$180k base" },
      { name: "answer", questionId: "where", value: ["Remote US", "Austin, TX"] },
      { name: "answer", questionId: "level", value: "Staff" },
      { name: "answer", questionId: "breakers", value: ["On-call", "Travel"] },
    ]);
    // Sent once: the button is spent and a second press sends nothing.
    fireEvent.click(screen.getByRole("button", { name: "Answers sent" }));
    expect(onIntent).toHaveBeenCalledTimes(4);
  });

  test("the intake answer cap is the answer intent's", () => {
    expect(INTAKE_ANSWER_MAX).toBe(ANSWER_MAX);
  });
});

describe("memo and profile", () => {
  const proposal: MemoProposal = {
    id: PROPOSAL_ID,
    baseVersion: 2,
    proposedDoc: { ...emptyMemoDoc(), compensation: "At least $180k base." },
    rationale: "You skipped three jobs for pay.",
    status: "pending",
    source: "interactive",
    createdAt: "2026-11-20T10:00:00.000Z",
  };
  const rows: BlockRows = { memo: { current: { ...emptyMemoDoc(), compensation: "Market rate." }, proposals: { [PROPOSAL_ID]: proposal } } };

  test("MemoDiff shows the proposal row's before and after and emits memo.review only", () => {
    const { onIntent } = renderBlocks([{ type: "MemoDiff", proposalId: PROPOSAL_ID }], gathered(), rows);
    expect(screen.getByText("Market rate.")).toBeTruthy();
    expect(screen.getByText("At least $180k base.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review this change" }));
    expect(emitted(onIntent)).toEqual([{ name: "memo.review", proposalId: PROPOSAL_ID }]);
  });

  test("a MemoDiff whose proposal is not pending shows a fixed line and no buttons", () => {
    renderBlocks([{ type: "MemoDiff", proposalId: PROPOSAL_ID }], gathered(), {
      memo: { current: emptyMemoDoc(), proposals: { [PROPOSAL_ID]: { ...proposal, status: "approved" } } },
    });
    expect(screen.getByText(MEMO_GONE_TEXT)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("ProfileReadback shows the gathered profile summary", () => {
    const g = gathered();
    g.profile = {
      name: "Sam Rivera", titles: ["Backend Engineer"], yearsOfExperience: 8, education: ["BS Computer Science"],
      preferredLocations: ["Remote"], workAuthorized: true, needsSponsorship: null,
    };
    renderBlocks([{ type: "ProfileReadback" }], g);
    expect(screen.getByText("Sam Rivera")).toBeTruthy();
    expect(screen.getByText("8 years")).toBeTruthy();
    expect(screen.getByText("Not stated")).toBeTruthy();
    renderBlocks([{ type: "ProfileReadback" }], { ...g, profile: null });
    expect(screen.getByText(NO_PROFILE_TEXT)).toBeTruthy();
  });
});

const RESUME: TailoredResume = {
  name: "Sam Rivera",
  contact: "sam@example.com",
  headline: "Senior Backend Engineer",
  summary: "Builds reliable data platforms.",
  // Three skills: the 12 to 16 skills check fails.
  skills: ["Go", "Postgres", "Kubernetes"],
  experience: [{ role: "Backend Engineer", company: "Initrode", dates: "2019 to 2026", bullets: ["Built the billing pipeline."] }],
  education: ["BS Computer Science"],
  certifications: [],
};

const COVER = { greeting: "Dear Hiring Manager,", paragraphs: ["I build data platforms."], closing: "Sincerely,", signature: "Sam Rivera" };

function pkg(over: Partial<PackageView> = {}): PackageView {
  return {
    status: "prepared", resume: RESUME, coverLetter: COVER, coverLetterEditedText: null,
    prefilledAnswers: [{ question: "Why us?", answer: "Your data work." }],
    applyUrl: "https://boards.greenhouse.io/acme/jobs/101", ats: "greenhouse", ...over,
  };
}

function generation(status: "pending" | "ready" | "failed", over: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-0000000000d1", jobId: JOB_A, kind: "prepare", status, error: null,
    jobTitle: "Staff Platform Engineer", company: "Acme Systems",
    createdAt: "2026-11-25T10:00:00.000Z", updatedAt: status === "pending" ? "2026-11-25T10:00:00.000Z" : "2026-11-25T10:02:00.000Z",
    ...over,
  };
}

function respond(body: unknown) {
  return { ok: true, status: 200, type: "basic", redirected: false, json: async () => body };
}

describe("prep blocks", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("PrepChecklist shows résumé, letter and answers and updates from the generations poll", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ generations: [generation("pending"), generation("pending", { jobId: JOB_B, id: "x" })] }))
      .mockResolvedValue(respond({ generations: [generation("ready", { error: "The cover letter failed. Try again." })] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    renderBlocks([{ type: "PrepChecklist", jobId: JOB_A }]);
    const list = screen.getByRole("list", { name: "Prep checklist" });
    const status = () => within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(status()).toEqual(["Tailored résuméNot started", "Cover letterNot started", "Application answersNot started"]);
    await waitFor(() => expect(status()).toEqual(["Tailored résuméGenerating", "Cover letterGenerating", "Application answersGenerating"]));
    expect(fetchMock).toHaveBeenCalledWith("/api/generations", expect.objectContaining({ redirect: "manual" }));

    await vi.advanceTimersByTimeAsync(PREP_POLL_MS);
    await waitFor(() => expect(status()).toEqual(["Tailored résuméFinished", "Cover letterFinished", "Application answersFinished"]));
    expect(screen.getByText("The cover letter failed. Try again.")).toBeTruthy();
    // Nothing is pending any more, so the poll stops.
    const calls = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(PREP_POLL_MS * 3);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  test("PrepChecklist reads what is ready from the package row and offers prep only when nothing is", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ generations: [] })));
    const { onIntent } = renderBlocks([{ type: "PrepChecklist", jobId: JOB_A }, { type: "PrepChecklist", jobId: JOB_B }], gathered(), {
      packages: { [JOB_A]: pkg({ coverLetter: "not a letter" }) },
    });
    const [ready, empty] = screen.getAllByRole("list", { name: "Prep checklist" });
    expect(within(ready).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Tailored résuméReady", "Cover letterNot started", "Application answers1 prefilledReady",
    ]);
    expect(within(empty).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Tailored résuméNot started", "Cover letterNot started", "Application answersNot started",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Open documents" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare application" }));
    expect(emitted(onIntent)).toEqual([{ name: "open", target: "documents" }, { name: "application.prepare", jobId: JOB_B }]);
  });

  test("EvidenceMap marks gaps and lists failed resumeChecks under the map", () => {
    const g = gathered();
    // The review marks requirement 1 (the agent's gap) and requirement 2 as not met.
    g.reviews[JOB_A] = { ...g.reviews[JOB_A], requirements: [{ text: "Requirement 0", met: true }, { text: "Requirement 1", met: false }, { text: "Requirement 2", met: false }] };
    renderBlocks(
      [
        {
          type: "EvidenceMap",
          jobId: JOB_A,
          rows: [
            { requirementIndex: 0, evidence: "Led the billing pipeline at Initrode.", gap: false },
            { requirementIndex: 1, evidence: "No Rust in the résumé.", gap: true },
            { requirementIndex: 2, evidence: "Some Kubernetes work.", gap: false },
          ],
        },
      ],
      g,
      { packages: { [JOB_A]: pkg() } },
    );
    // Requirement text comes from the review, by index.
    const items = screen.getAllByRole("listitem").filter((li) => li.className.includes("rf-block-evidence__row"));
    expect(items.map((li) => within(li).getByText(/^Requirement \d$/).textContent)).toEqual(["Requirement 0", "Requirement 1", "Requirement 2"]);
    expect(within(items[1]).getByText("Gap")).toBeTruthy();
    expect(within(items[0]).getByText("Evidence")).toBeTruthy();
    expect(screen.getByText("1 gap noted.")).toBeTruthy();
    // Where the review says unmet but the agent saw no gap, the block says so.
    expect(within(items[1]).queryByText("The review marked this requirement as not met.")).toBeNull();
    expect(within(items[2]).getByText("The review marked this requirement as not met.")).toBeTruthy();
    const failed = screen.getByRole("list", { name: "Failed résumé checks" });
    expect(within(failed).getByText("12–16 skills (3 skills)")).toBeTruthy();
  });

  test("the apply link uses apply_url from the package row", () => {
    const { onIntent } = renderBlocks([{ type: "DocumentPreview", jobId: JOB_A, doc: "resume" }], gathered(), { packages: { [JOB_A]: pkg() } });
    const apply = screen.getByRole("link", { name: "Apply on Greenhouse" });
    expect(apply.getAttribute("href")).toBe("https://boards.greenhouse.io/acme/jobs/101");
    expect(apply.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Built the billing pipeline.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark applied" }));
    expect(emitted(onIntent)).toEqual([{ name: "application.set_stage", jobId: JOB_A, stage: "applied" }]);
  });

  test("DocumentPreview shows no apply link for a non-http apply_url and no Mark applied once applied", () => {
    renderBlocks([{ type: "DocumentPreview", jobId: JOB_A, doc: "cover" }], gathered(), {
      packages: { [JOB_A]: pkg({ applyUrl: "javascript:alert(1)", status: "applied", coverLetterEditedText: "My own letter." }) },
    });
    expect(screen.queryAllByRole("link").filter((a) => a.textContent?.startsWith("Apply"))).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mark applied" })).toBeNull();
    expect(screen.getByText("Applied")).toBeTruthy();
    // The user's own edit is what they will send, so it is what is shown.
    expect(screen.getByText("My own letter.")).toBeTruthy();
  });

  test("Copy puts the document text on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderBlocks([{ type: "DocumentPreview", jobId: JOB_A, doc: "cover" }], gathered(), { packages: { [JOB_A]: pkg() } });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(composeCoverLetterText(COVER));
  });

  test("every rate in StatRow shows its n; a null rate shows 'not enough data yet'", () => {
    const g = gathered();
    g.metrics = [
      { spec: { metric: "response_rate", window: "30d" }, n: 12, kind: "value", value: 0.25 },
      { spec: { metric: "response_rate", window: "7d" }, n: 3, kind: "value", value: null },
      { spec: { metric: "stale_applications", window: "all" }, n: 9, kind: "value", value: 2 },
    ];
    renderBlocks([{ type: "StatRow", metricRefs: [0, 1, 2] }], g);
    const items = screen.getAllByRole("term").map((dt) => dt.parentElement!);
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("25%")).toBeTruthy();
    expect(within(items[0]).getByText("n = 12 · Last 30 days")).toBeTruthy();
    expect(within(items[1]).getByText(/not enough data yet/i)).toBeTruthy();
    expect(within(items[1]).getByText("n = 3 · Last 7 days")).toBeTruthy();
    expect(within(items[2]).getByText("n = 9 · All time")).toBeTruthy();
  });

  test("Pin to Analytics emits analytics.pin with a tile that passes TileSpecSchema", () => {
    const g = gathered();
    g.metrics = [
      { spec: { metric: "applications_by_stage", groupBy: "stage", filter: { stage: ["applied", "interviewing"] }, window: "90d" }, n: 7, kind: "rows", columns: ["stage", "count"], rows: [["applied", 5], ["interviewing", 2]] },
      VALUE_METRIC,
    ];
    const { onIntent } = renderBlocks([
      { type: "MetricChart", metricRef: 0, viz: "bar", title: "Where your applications are" },
      { type: "MetricChart", metricRef: 1, viz: "stat", title: "Response rate" },
    ], g);
    screen.getAllByRole("button", { name: "Pin to Analytics" }).forEach((b) => fireEvent.click(b));
    const intents = emitted(onIntent);
    expect(intents.map((i) => i.name)).toEqual(["analytics.pin", "analytics.pin"]);
    for (const intent of intents) {
      if (intent.name !== "analytics.pin") throw new Error("unexpected intent");
      expect(TileSpecSchema.safeParse(intent.tile).success).toBe(true);
    }
    const [bar, stat] = intents.map((i) => (i.name === "analytics.pin" ? i.tile : null));
    expect(bar).toMatchObject({ metric: "applications_by_stage", groupBy: "stage", filter: { stage: ["applied", "interviewing"] }, window: "90d", viz: "bar", title: "Where your applications are" });
    expect(stat).toMatchObject({ metric: "response_rate", viz: "stat", size: "small" });
    // The same chart gets the same tile id, so pinning it twice is caught.
    expect(pinTile(g.metrics[0].spec, "bar", "Another title").id).toBe(bar!.id);
    expect(pinTile(g.metrics[0].spec, "table", "Where").id).not.toBe(bar!.id);
  });

  test("charts sit inside data-ui-visual=\"data-viz\"", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const g = gathered();
    g.metrics = [
      SERIES_METRIC,
      { spec: { metric: "skip_reasons", groupBy: "reason", window: "30d" }, n: 4, kind: "rows", columns: ["reason", "count"], rows: [["pay", 3], ["location", 1]] },
      VALUE_METRIC,
    ];
    const { container } = renderBlocks([
      { type: "MetricChart", metricRef: 0, viz: "line", title: "Applications" },
      { type: "MetricChart", metricRef: 1, viz: "table", title: "Skips" },
      { type: "MetricChart", metricRef: 1, viz: "funnel", title: "Skips as bars" },
      { type: "MetricChart", metricRef: 2, viz: "stat", title: "Responses" },
    ], g);
    const charts = [...container.querySelectorAll(".rf-block-chart")];
    expect(charts).toHaveLength(4);
    for (const chart of charts) {
      const visual = chart.querySelector('[data-ui-visual="data-viz"]');
      expect(visual).not.toBeNull();
      expect(visual!.textContent).toContain(chart.getAttribute("aria-label")!);
    }
    expect(within(charts[1] as HTMLElement).getByText("pay")).toBeTruthy();
  });

  test("StaleList lists quiet applied applications by the catalog clock, oldest first", () => {
    const g = gathered();
    const app = (id: string, jobId: string, stage: "applied" | "interviewing", updatedAt: string) => ({
      id, jobId, stage, closedReason: null, nextStepOn: null, updatedAt, job: g.jobs[jobId], events: [],
      documents: { resume: true, cover: false, outdated: false },
    });
    g.applications = [
      app("a1", JOB_A, "applied", "2026-11-01T00:00:00.000Z"),
      app("a2", JOB_B, "applied", "2026-11-20T00:00:00.000Z"),
      app("a3", JOB_B, "interviewing", "2026-10-01T00:00:00.000Z"),
    ];
    const { onIntent } = renderBlocks([{ type: "StaleList", limit: 5 }], g, { now: "2026-11-25T00:00:00.000Z" });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("24 days with no news")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close as no response" }));
    expect(emitted(onIntent)).toEqual([{ name: "application.set_stage", jobId: JOB_A, stage: "closed", closedReason: "no_response" }]);
    cleanup();
    // Without the catalog clock no age is claimed.
    renderBlocks([{ type: "StaleList", limit: 5 }], g);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Last activity 2026-11-01"),
      expect.stringContaining("Last activity 2026-11-20"),
    ]);
    cleanup();
    renderBlocks([{ type: "StaleList", limit: 5 }], { ...g, applications: [] });
    expect(screen.getByText(NO_APPLICATIONS_TEXT)).toBeTruthy();
  });

  test("prep blocks for a job missing from gathered data render the unavailable line and no buttons", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ generations: [] })));
    renderBlocks([
      { type: "PrepChecklist", jobId: MISSING },
      { type: "DocumentPreview", jobId: MISSING, doc: "resume" },
    ], gathered(), { packages: { [MISSING]: pkg() } });
    expect(screen.getAllByText(UNAVAILABLE_TEXT)).toHaveLength(2);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("visual fixtures", () => {
  test("the agent-blocks-jobs fixture is a valid payload whose job ids were all gathered", () => {
    const parsed = SurfacePayloadV1Schema.parse(JOBS_FIXTURE_PAYLOAD);
    const ids = parsed.blocks.flatMap((b) => ("jobId" in b ? [b.jobId] : "jobIds" in b ? b.jobIds : []));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(Object.keys(FIXTURE_GATHERED.jobs)).toContain(id);
    render(<AgentBlocksJobsFixture />);
    expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
    expect(screen.queryByText(MEMO_GONE_TEXT)).toBeNull();
  });

  test("the agent-blocks-prep fixture is a valid payload whose ids and metric refs all resolve", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({ generations: [] })));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    try {
      const parsed = SurfacePayloadV1Schema.parse(PREP_FIXTURE_PAYLOAD);
      const ids = parsed.blocks.flatMap((b) => ("jobId" in b ? [b.jobId] : []));
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(Object.keys(PREP_FIXTURE_GATHERED.jobs)).toContain(id);
      render(<AgentBlocksPrepFixture />);
      expect(screen.queryByText(UNAVAILABLE_TEXT)).toBeNull();
      expect(screen.queryByText(METRIC_GONE_TEXT)).toBeNull();
      expect(screen.queryByText(NO_APPLICATIONS_TEXT)).toBeNull();
      expect(screen.getByRole("link", { name: "Apply on Greenhouse" })).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
