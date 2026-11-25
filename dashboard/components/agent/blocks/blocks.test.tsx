// @vitest-environment jsdom
// The variant 1 blocks (plan Tasks 1.18 and 1.19). Every bound field comes from the
// turn's gathered data (or a database row the block is given), agent text renders as
// plain text, and every press emits one intent that passes the closed enum.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ActionIntentSchema, ANSWER_MAX, type ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import { SurfacePayloadV1Schema, type SurfacePayloadV1, type V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { JOB_A, JOB_B, gatheredFixture, jobFacts, reviewFacts } from "@/lib/agent/surfaces/v1/testFixtures";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import type { MemoProposal } from "@/lib/workspaces/types";
import { AgentBlocksJobsFixture, FIXTURE_GATHERED, JOBS_FIXTURE_PAYLOAD } from "./AgentBlocksFixture";
import { BlockList } from "./BlockList";
import { COMPARISON_ROW_LABELS } from "./JobComparisonBlock";
import { INTAKE_ANSWER_MAX } from "./IntakeQuestionsBlock";
import { MEMO_GONE_TEXT } from "./MemoDiffBlock";
import { NO_PROFILE_TEXT } from "./ProfileReadbackBlock";
import { UNAVAILABLE_TEXT, type BlockRows } from "./types";

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
});
