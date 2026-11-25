// @vitest-environment jsdom
// The "What I'm looking for" page (plan Task 1.8). The server actions are mocked.
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import type { MemoDoc, MemoProposal, MemoVersion } from "@/lib/workspaces/types";

const actions = vi.hoisted(() => ({
  saveMemoAction: vi.fn(),
  resolveProposalAction: vi.fn(),
  restoreMemoAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/memo", () => ({
  saveMemoAction: actions.saveMemoAction,
  resolveProposalAction: actions.resolveProposalAction,
  restoreMemoAction: actions.restoreMemoAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));

import { MemoDiffCard } from "./MemoDiffCard";
import { MemoEditor } from "./MemoEditor";
import { MemoStructured } from "./MemoStructured";
import { MemoVersions } from "./MemoVersions";

const doc = (over: Partial<MemoDoc> = {}): MemoDoc => ({ ...emptyMemoDoc(), role: "Senior backend engineer", ...over });

function proposal(over: Partial<MemoProposal> = {}): MemoProposal {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    baseVersion: 3,
    proposedDoc: doc({ compensation: "At least $180k base", dealBreakers: "No on-call rotations" }),
    rationale: "You skipped four jobs for pay and two for on-call.",
    status: "pending",
    source: "interactive",
    createdAt: "2026-11-20T10:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  for (const fn of [actions.saveMemoAction, actions.resolveProposalAction, actions.restoreMemoAction]) {
    fn.mockReset().mockResolvedValue({ ok: true, version: 4 });
  }
  actions.refresh.mockReset();
});
afterEach(cleanup);

test("the diff card shows only changed sections with before and after", () => {
  render(<MemoDiffCard proposal={proposal()} current={doc({ compensation: "Market rate" })} onApprove={vi.fn()} onEdit={vi.fn()} onDecline={vi.fn()} />);
  const card = screen.getByRole("article", { name: "Proposed change to what you're looking for" });
  const sections = within(card).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(sections).toEqual(["Compensation", "Deal-breakers"]);
  expect(card.textContent).toContain("Market rate");
  expect(card.textContent).toContain("At least $180k base");
  expect(card.textContent).toContain("No on-call rotations");
  expect(card.textContent).not.toContain("Role and seniority");
  expect(card.textContent).toContain("You skipped four jobs for pay and two for on-call.");
  for (const name of ["Approve", "Edit", "Decline"]) expect(within(card).getByRole("button", { name })).toBeTruthy();
});

test("a proposal against an older version can only be declined", () => {
  const onDecline = vi.fn();
  render(<MemoDiffCard proposal={proposal()} current={doc()} outdated onApprove={vi.fn()} onEdit={vi.fn()} onDecline={onDecline} />);
  expect(screen.getByText(/older version/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  expect(onDecline).toHaveBeenCalled();
});

test("Approve and Decline on the page send the proposal's decision", async () => {
  render(<MemoEditor memo={{ version: 3, doc: doc(), pending: [proposal()] }} versions={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(actions.resolveProposalAction).toHaveBeenCalledWith(proposal().id, "approve"));
  await waitFor(() => expect((screen.getByRole("button", { name: "Decline" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  await waitFor(() => expect(actions.resolveProposalAction).toHaveBeenCalledWith(proposal().id, "decline"));
  expect(actions.refresh).toHaveBeenCalled();
});

test("Edit opens the proposed text in the editor and Approve then sends the edited doc", async () => {
  render(<MemoEditor memo={{ version: 3, doc: doc(), pending: [proposal()] }} versions={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const comp = screen.getByLabelText("Compensation") as HTMLTextAreaElement;
  expect(comp.value).toBe("At least $180k base");
  fireEvent.change(comp, { target: { value: "At least $170k base" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve with edits" }));
  await waitFor(() =>
    expect(actions.resolveProposalAction).toHaveBeenCalledWith(proposal().id, "approve", {
      ...proposal().proposedDoc,
      compensation: "At least $170k base",
    }),
  );
  expect(actions.saveMemoAction).not.toHaveBeenCalled();
});

test("saving the memo sends the edited doc; a refusal is shown and nothing refreshes", async () => {
  actions.saveMemoAction.mockResolvedValueOnce({ ok: false, message: "That memo is 12 characters too long." });
  render(<MemoEditor memo={{ version: 3, doc: doc(), pending: [] }} versions={[]} />);
  const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Must-haves"), { target: { value: "Go or Rust" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(actions.saveMemoAction).toHaveBeenCalledWith(doc({ mustHaves: "Go or Rust" })));
  expect(await screen.findByText("That memo is 12 characters too long.")).toBeTruthy();
  expect(actions.refresh).not.toHaveBeenCalled();
});

test("a memo whose compiled text runs over the cap cannot be saved", () => {
  render(<MemoEditor memo={{ version: 1, doc: doc(), pending: [] }} versions={[]} />);
  for (const label of ["Must-haves", "Deal-breakers", "Anything else", "Companies and industries"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "x".repeat(1800) } });
  }
  expect(screen.getByText(/characters too long/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
});

test("old instructions cut to fit are flagged before the first save", () => {
  render(<MemoEditor memo={{ version: 0, doc: doc(), pending: [], legacyTruncated: true, legacyLength: 2600 }} versions={[]} />);
  expect(screen.getByText(/2,600 characters/)).toBeTruthy();
});

test("proposal text containing <script> or a markdown link renders literally", () => {
  const hostile = "<script>alert(1)</script> see [this](https://evil.example)";
  const { container } = render(
    <MemoDiffCard
      proposal={proposal({ proposedDoc: doc({ other: hostile }), rationale: "**bold** <img src=x>" })}
      current={doc()}
      onApprove={vi.fn()}
      onEdit={vi.fn()}
      onDecline={vi.fn()}
    />,
  );
  expect(container.textContent).toContain(hostile);
  expect(container.textContent).toContain("**bold** <img src=x>");
  expect(container.querySelector("script, img, strong")).toBeNull();
  expect(container.querySelector("a")).toBeNull();
});

test("versions list who changed each version and offers Restore", () => {
  const versions: MemoVersion[] = [
    { version: 3, doc: doc(), changedBy: "restore", createdAt: "2026-11-21T00:00:00.000Z" },
    { version: 2, doc: doc(), changedBy: "proposal", createdAt: "2026-11-20T00:00:00.000Z" },
    { version: 1, doc: doc(), changedBy: "user", createdAt: "2026-11-19T00:00:00.000Z" },
  ];
  const onRestore = vi.fn();
  render(<MemoVersions versions={versions} currentVersion={3} pending={false} onRestore={onRestore} />);
  const items = within(screen.getByRole("list", { name: "Versions" })).getAllByRole("listitem");
  expect(items[0].textContent).toContain("Version 3");
  expect(items[0].textContent).toContain("Restored");
  expect(items[0].textContent).toContain("Current");
  expect(within(items[0]).queryByRole("button", { name: "Restore" })).toBeNull();
  expect(items[1].textContent).toContain("Agent proposal you approved");
  expect(items[2].textContent).toContain("You");
  fireEvent.click(within(items[2]).getByRole("button", { name: "Restore" }));
  expect(onRestore).toHaveBeenCalledWith(1);
});

test("Restore on the page calls the restore action", async () => {
  const versions: MemoVersion[] = [
    { version: 2, doc: doc(), changedBy: "user", createdAt: "2026-11-20T00:00:00.000Z" },
    { version: 1, doc: doc({ role: "Staff engineer" }), changedBy: "user", createdAt: "2026-11-19T00:00:00.000Z" },
  ];
  render(<MemoEditor memo={{ version: 2, doc: doc(), pending: [] }} versions={versions} />);
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(actions.restoreMemoAction).toHaveBeenCalledWith(1));
});

test("locations and company exclusions are edited through their existing actions", () => {
  render(
    <MemoStructured
      locations={["Remote", "New York, NY"]}
      exclusions={{ industries: ["finance"], sizes: [], redFlagCategories: ["defense_military", "non_tech"], countries: [] }}
    />,
  );
  expect(screen.getByText("Remote; New York, NY")).toBeTruthy();
  expect(screen.getByText(/1 industry, 2 red-flag categories/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Edit locations and company filters" }).getAttribute("href")).toBe("/profile/job-preferences");
  // The memo's own actions never write those columns; the job-preferences page's
  // saveJobPreferences and saveCompanyFilters stay their only writers.
  const memoActions = readFileSync("app/actions/memo.ts", "utf8");
  expect(memoActions).not.toMatch(/preferred_locations|company_exclusions|profileSettings/);
});
