// @vitest-environment jsdom
// The shortlist page's board (plan Task 1.5). The server actions are mocked; the page
// itself is checked by reading its source (it must write nothing on render).
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ShortlistRow } from "@/lib/workspaces/types";

const actions = vi.hoisted(() => ({
  setShortlistStateAction: vi.fn(),
  refreshSuggestedAction: vi.fn(),
  undoAgentAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/shortlist", () => ({
  setShortlistStateAction: actions.setShortlistStateAction,
  refreshSuggestedAction: actions.refreshSuggestedAction,
}));
vi.mock("@/app/actions/agent", () => ({ undoAgentAction: actions.undoAgentAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));

import { ShortlistBoard } from "./ShortlistBoard";

function row(jobId: string, over: Partial<ShortlistRow> = {}): ShortlistRow {
  return {
    jobId,
    state: "suggested",
    reasonCode: null,
    reasonText: null,
    briefWhy: `Why ${jobId}`,
    briefRisk: `Risk ${jobId}`,
    setBy: "system",
    updatedAt: "2026-11-20T00:00:00.000Z",
    fitScore: 81,
    job: {
      jobId,
      title: `Title ${jobId}`,
      company: "Acme",
      location: "Remote",
      remote: true,
      url: `https://jobs.example.com/${jobId.replace(/:/g, "-")}`,
      firstSeenAt: "2026-11-18T00:00:00.000Z",
      ageDays: 2,
      closed: false,
    },
    ...over,
  };
}

const NO_FILTERS = { verdict: null, minFit: null, remote: false } as const;

beforeEach(() => {
  actions.setShortlistStateAction.mockReset().mockResolvedValue(undefined);
  actions.refreshSuggestedAction.mockReset().mockResolvedValue(3);
  actions.undoAgentAction.mockReset().mockResolvedValue({ ok: true });
  actions.refresh.mockReset();
});
afterEach(cleanup);

function renderBoard(rows: ShortlistRow[], markers: Record<string, number> = {}) {
  return render(<ShortlistBoard rows={rows} markers={markers} browse={[]} filters={NO_FILTERS} browseError={false} />);
}

test("triage buttons are one tap and need no chat", async () => {
  renderBoard([row("gh:acme:1")]);
  const card = screen.getByRole("article", { name: "Title gh:acme:1" });
  expect(within(card).getByRole("button", { name: "Shortlist" })).toBeTruthy();
  expect(within(card).getByRole("button", { name: "Later" })).toBeTruthy();
  expect(within(card).getByRole("button", { name: "Skip" })).toBeTruthy();
  fireEvent.click(within(card).getByRole("button", { name: "Shortlist" }));
  await waitFor(() => expect(actions.setShortlistStateAction).toHaveBeenCalledWith("gh:acme:1", "shortlisted"));
  fireEvent.click(within(card).getByRole("button", { name: "Later" }));
  await waitFor(() => expect(actions.setShortlistStateAction).toHaveBeenCalledWith("gh:acme:1", "later"));
});

test("Skip asks for one of the eight user reasons and sends it", async () => {
  renderBoard([row("gh:acme:1")]);
  const card = screen.getByRole("article", { name: "Title gh:acme:1" });
  fireEvent.click(within(card).getByRole("button", { name: "Skip" }));
  expect(actions.setShortlistStateAction).not.toHaveBeenCalled();
  const picker = within(card).getByRole("group", { name: "Why skip this job?" });
  const reasons = within(picker).getAllByRole("button").map((b) => b.textContent);
  expect(reasons).toEqual(["Pay", "Location", "Seniority", "Schedule", "Company", "Tech stack", "Posting too old", "Other", "Cancel"]);
  fireEvent.change(within(card).getByLabelText(/Note/), { target: { value: "Too far" } });
  fireEvent.click(within(picker).getByRole("button", { name: "Location" }));
  await waitFor(() =>
    expect(actions.setShortlistStateAction).toHaveBeenCalledWith("gh:acme:1", "skipped", "location", "Too far"),
  );
});

test("an agent-skipped row shows the reason, the marker and Undo", async () => {
  renderBoard(
    [row("gh:acme:2", { state: "skipped", setBy: "agent", reasonCode: "red_flag", reasonText: "Unpaid trial week" })],
    { "gh:acme:2": 42 },
  );
  const card = screen.getByRole("article", { name: "Title gh:acme:2" });
  expect(within(card).getByText("Red flag")).toBeTruthy();
  expect(within(card).getByText("Unpaid trial week")).toBeTruthy();
  expect(within(card).getByText("by agent")).toBeTruthy();
  fireEvent.click(within(card).getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(actions.undoAgentAction).toHaveBeenCalledWith(42));
  await waitFor(() => expect(actions.refresh).toHaveBeenCalled());
});

test("an undo refused because the row changed says so and leaves the row alone", async () => {
  actions.undoAgentAction.mockResolvedValue({ ok: false, reason: "changed_since" });
  renderBoard([row("gh:acme:2", { state: "later", setBy: "agent" })], { "gh:acme:2": 7 });
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(await screen.findByText("This changed since")).toBeTruthy();
  expect(actions.refresh).not.toHaveBeenCalled();
});

test("a row the user set shows no agent marker", () => {
  renderBoard([row("gh:acme:3", { state: "later", setBy: "user" })], { "gh:acme:3": 9 });
  expect(screen.queryByText("by agent")).toBeNull();
});

test("Compare is enabled only with exactly two rows checked", () => {
  renderBoard([row("gh:acme:1"), row("gh:acme:2"), row("gh:acme:3")]);
  const compareButton = () => screen.queryByRole("button", { name: "Compare" }) as HTMLButtonElement | null;
  const compareLink = () => screen.queryByRole("link", { name: "Compare" }) as HTMLAnchorElement | null;
  expect(compareButton()?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Compare Title gh:acme:1" }));
  expect(compareButton()?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Compare Title gh:acme:3" }));
  expect(compareButton()).toBeNull();
  expect(compareLink()?.getAttribute("href")).toBe(
    `/agent?compare=${encodeURIComponent("gh:acme:1")},${encodeURIComponent("gh:acme:3")}`,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Compare Title gh:acme:2" }));
  expect(compareLink()).toBeNull();
  expect(compareButton()?.disabled).toBe(true);
});

test("posting link href equals job.url from the row", () => {
  const r = row("gh:acme:1");
  renderBoard([r]);
  const link = screen.getByRole("link", { name: "Title gh:acme:1" });
  expect(link.getAttribute("href")).toBe(r.job.url);
  expect(link.getAttribute("rel")).toContain("noopener");
});

test("an empty shortlist shows the fixed empty state with a link to the agent", () => {
  renderBoard([]);
  expect(screen.getByText("Nothing on your shortlist yet")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ask the agent" }).getAttribute("href")).toBe("/agent");
});

test("Refresh suggestions appears when Suggested is empty and calls the action", async () => {
  renderBoard([row("gh:acme:1", { state: "shortlisted", setBy: "user" })]);
  fireEvent.click(screen.getByRole("button", { name: "Refresh suggestions" }));
  await waitFor(() => expect(actions.refreshSuggestedAction).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(actions.refresh).toHaveBeenCalled());
});

test("Refresh suggestions is not offered while Suggested has rows", () => {
  renderBoard([row("gh:acme:1")]);
  expect(screen.queryByRole("button", { name: "Refresh suggestions" })).toBeNull();
});

test("sections come in the order Suggested, Shortlisted, Later, Skipped, Browse all", () => {
  renderBoard([
    row("gh:acme:4", { state: "skipped", setBy: "user", reasonCode: "pay" }),
    row("gh:acme:3", { state: "later", setBy: "user" }),
    row("gh:acme:2", { state: "shortlisted", setBy: "user" }),
    row("gh:acme:1"),
  ]);
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.replace(/\s*\d+$/, ""));
  expect(headings).toEqual(["Suggested", "Shortlisted", "Later", "Skipped", "Browse all"]);
});

test("browse rows show title, company, fit, pay and age, and can be shortlisted", async () => {
  render(
    <ShortlistBoard
      rows={[]}
      markers={{}}
      filters={{ verdict: "approve", minFit: 70, remote: true }}
      browseError={false}
      browse={[{ jobId: "gh:acme:9", title: "Data Engineer", company: "Initech", url: "https://jobs.example.com/9", fitScore: 77.6, pay: "$150k–$180k", ageDays: 3 }]}
    />,
  );
  const item = screen.getByRole("article", { name: "Data Engineer" });
  expect(within(item).getByText("Initech")).toBeTruthy();
  expect(within(item).getByText("78 fit")).toBeTruthy();
  expect(within(item).getByText("$150k–$180k")).toBeTruthy();
  expect(within(item).getByText("3 days old")).toBeTruthy();
  expect(within(item).getByRole("link", { name: "Data Engineer" }).getAttribute("href")).toBe("https://jobs.example.com/9");
  fireEvent.click(within(item).getByRole("button", { name: "Add to shortlist" }));
  await waitFor(() => expect(actions.setShortlistStateAction).toHaveBeenCalledWith("gh:acme:9", "shortlisted"));
  expect((screen.getByLabelText("Minimum fit") as HTMLInputElement).value).toBe("70");
});

test("app/shortlist/page.tsx does not import fillSuggested or any mutation helper", () => {
  const source = readFileSync("app/shortlist/page.tsx", "utf8");
  const imports = [...source.matchAll(/^import[^;]*?from\s+"([^"]+)"/gms)].map((m) => m[0]);
  expect(imports.length).toBeGreaterThan(0);
  for (const line of imports) {
    expect(line).not.toMatch(/fillSuggested|@\/lib\/workspaces\/suggested|setShortlistState\b|undoAction|withUserMutation|withUserPayloadMutation|@\/app\/actions\//);
  }
  expect(source).not.toMatch(/fillSuggested\s*\(/);
});
