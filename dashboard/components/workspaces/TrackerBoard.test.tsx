// @vitest-environment jsdom
// The application tracker (plan Task 1.6). The server actions are mocked.
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ApplicationEvent, ApplicationRow, Stage } from "@/lib/workspaces/types";

const actions = vi.hoisted(() => ({
  setStageAction: vi.fn(),
  addNoteAction: vi.fn(),
  setNextStepAction: vi.fn(),
  undoAgentAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/tracker", () => ({
  setStageAction: actions.setStageAction,
  addNoteAction: actions.addNoteAction,
  setNextStepAction: actions.setNextStepAction,
}));
vi.mock("@/app/actions/agent", () => ({ undoAgentAction: actions.undoAgentAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));

import { TrackerBoard } from "./TrackerBoard";

let nextId = 1;
function event(over: Partial<ApplicationEvent>): ApplicationEvent {
  return { id: nextId++, kind: "stage", fromStage: null, toStage: null, note: null, actor: "user", createdAt: "2026-11-10T12:00:00.000Z", ...over };
}

function app(jobId: string, stage: Stage, over: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: `app-${jobId}`,
    jobId,
    stage,
    closedReason: stage === "closed" ? "rejected" : null,
    nextStepOn: null,
    updatedAt: "2026-11-10T12:00:00.000Z",
    events: [event({ toStage: stage })],
    documents: { resume: false, cover: false, outdated: false },
    job: {
      jobId,
      title: `Title ${jobId}`,
      company: "Acme",
      location: null,
      remote: true,
      url: `https://jobs.example.com/${jobId.replace(/:/g, "-")}`,
      firstSeenAt: "2026-11-01T00:00:00.000Z",
      ageDays: 9,
      closed: false,
    },
    ...over,
  };
}

beforeEach(() => {
  nextId = 1;
  actions.setStageAction.mockReset().mockResolvedValue(undefined);
  actions.addNoteAction.mockReset().mockResolvedValue(undefined);
  actions.setNextStepAction.mockReset().mockResolvedValue(undefined);
  actions.undoAgentAction.mockReset().mockResolvedValue({ ok: true });
  actions.refresh.mockReset();
});
afterEach(cleanup);

test("the page groups rows by stage in the order preparing..closed and shows stage history", () => {
  const history = [
    event({ toStage: "ready" }),
    event({ fromStage: "ready", toStage: "applied", actor: "agent" }),
    event({ kind: "note", note: "Recruiter screen booked <b>Tuesday</b>" }),
  ];
  render(
    <TrackerBoard
      rows={[
        app("gh:a:6", "closed"),
        app("gh:a:3", "applied", { events: history }),
        app("gh:a:1", "preparing"),
        app("gh:a:5", "offer"),
        app("gh:a:2", "ready"),
        app("gh:a:4", "interviewing"),
      ]}
      markers={{}}
    />,
  );
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.replace(/\s*\d+$/, ""));
  expect(headings).toEqual(["Preparing", "Ready to apply", "Applied", "Interviewing", "Offer", "Closed"]);
  const applied = screen.getByRole("article", { name: "Title gh:a:3" });
  const items = within(within(applied).getByRole("list", { name: "History" })).getAllByRole("listitem").map((li) => li.textContent);
  expect(items[0]).toContain("Moved to Ready to apply");
  expect(items[1]).toContain("Moved from Ready to apply to Applied");
  expect(items[1]).toContain("agent");
  expect(items[2]).toContain("Recruiter screen booked <b>Tuesday</b>");
  expect(applied.querySelector("b")).toBeNull();
  expect(screen.getByRole("article", { name: "Title gh:a:6" }).textContent).toContain("Rejected");
});

test("a job URL that is not http(s) renders the title without a link", () => {
  const bad = app("gh:acme:1", "preparing");
  render(<TrackerBoard rows={[{ ...bad, job: { ...bad.job, url: "javascript:alert(1)" } }]} markers={{}} />);
  expect(screen.queryByRole("link", { name: "Title gh:acme:1" })).toBeNull();
  expect(screen.getAllByText("Title gh:acme:1").length).toBeGreaterThan(0);
  expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
});

test("after a refresh moves a row (an Undo, say), its controls show the new stage", () => {
  const before = app("gh:a:1", "interviewing");
  const { rerender } = render(<TrackerBoard rows={[before]} markers={{}} />);
  rerender(<TrackerBoard rows={[{ ...before, stage: "applied", updatedAt: "2026-11-11T12:00:00.000Z" }]} markers={{}} />);
  const card = screen.getByRole("article", { name: "Title gh:a:1" });
  expect((within(card).getByLabelText("Stage") as HTMLSelectElement).value).toBe("applied");
  expect((within(card).getByRole("button", { name: "Move" }) as HTMLButtonElement).disabled).toBe(true);
});

test("after a refresh changes a row's next step in place, the date field shows the new one", () => {
  const before = app("gh:a:1", "applied", { nextStepOn: "2026-12-01" });
  const { rerender } = render(<TrackerBoard rows={[before]} markers={{}} />);
  rerender(<TrackerBoard rows={[{ ...before, nextStepOn: "2026-12-09", updatedAt: "2026-11-11T12:00:00.000Z" }]} markers={{}} />);
  const card = screen.getByRole("article", { name: "Title gh:a:1" });
  expect((within(card).getByLabelText("Next step on") as HTMLInputElement).value).toBe("2026-12-09");
  expect((within(card).getByRole("button", { name: "Save date" }) as HTMLButtonElement).disabled).toBe(true);
});

test("an empty tracker shows the fixed empty state with a link to the shortlist", () => {
  render(<TrackerBoard rows={[]} markers={{}} />);
  expect(screen.getByText("No applications tracked yet")).toBeTruthy();
  // Every way the copy names exists: Start preparing on the shortlist, Mark applied on
  // the board, and the agent.
  expect(
    screen.getByText("Choose Start preparing on a shortlisted job, mark a job applied on your board, or ask the agent to track one."),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open your shortlist" }).getAttribute("href")).toBe("/shortlist");
});

test("moving a row sends the new stage; closing asks for a reason first", async () => {
  render(<TrackerBoard rows={[app("gh:a:1", "applied")]} markers={{}} />);
  const card = screen.getByRole("article", { name: "Title gh:a:1" });
  fireEvent.change(within(card).getByLabelText("Stage"), { target: { value: "interviewing" } });
  fireEvent.click(within(card).getByRole("button", { name: "Move" }));
  await waitFor(() => expect(actions.setStageAction).toHaveBeenCalledWith("gh:a:1", "interviewing"));

  fireEvent.change(within(card).getByLabelText("Stage"), { target: { value: "closed" } });
  const move = within(card).getByRole("button", { name: "Move" }) as HTMLButtonElement;
  expect(move.disabled).toBe(true);
  fireEvent.change(within(card).getByLabelText("Why it closed"), { target: { value: "withdrawn" } });
  fireEvent.click(within(card).getByRole("button", { name: "Move" }));
  await waitFor(() => expect(actions.setStageAction).toHaveBeenCalledWith("gh:a:1", "closed", "withdrawn"));
});

test("a note and a next step are saved through their actions", async () => {
  render(<TrackerBoard rows={[app("gh:a:1", "applied")]} markers={{}} />);
  const card = screen.getByRole("article", { name: "Title gh:a:1" });
  fireEvent.change(within(card).getByLabelText("Add a note"), { target: { value: "Sent thank-you email" } });
  fireEvent.click(within(card).getByRole("button", { name: "Add note" }));
  await waitFor(() => expect(actions.addNoteAction).toHaveBeenCalledWith("gh:a:1", "Sent thank-you email"));
  fireEvent.change(within(card).getByLabelText("Next step on"), { target: { value: "2026-12-02" } });
  fireEvent.click(within(card).getByRole("button", { name: "Save date" }));
  await waitFor(() => expect(actions.setNextStepAction).toHaveBeenCalledWith("gh:a:1", "2026-12-02"));
});

test("documents show for the job, with Outdated when the profile changed", () => {
  render(<TrackerBoard rows={[app("gh:a:1", "applied", { documents: { resume: true, cover: true, outdated: true } })]} markers={{}} />);
  const card = screen.getByRole("article", { name: "Title gh:a:1" });
  expect(within(card).getByText("Résumé")).toBeTruthy();
  expect(within(card).getByText("Cover letter")).toBeTruthy();
  expect(within(card).getByText("Outdated")).toBeTruthy();
});

test("the agent marker shows when the agent made the latest stage move", async () => {
  render(
    <TrackerBoard
      rows={[
        app("gh:a:1", "applied", { events: [event({ toStage: "ready" }), event({ fromStage: "ready", toStage: "applied", actor: "agent" })] }),
        app("gh:a:2", "applied", { events: [event({ toStage: "applied", actor: "agent" }), event({ fromStage: "applied", toStage: "applied" })] }),
      ]}
      markers={{ "gh:a:1": 5, "gh:a:2": 6 }}
    />,
  );
  const agentCard = screen.getByRole("article", { name: "Title gh:a:1" });
  expect(within(agentCard).getByText("by agent")).toBeTruthy();
  fireEvent.click(within(agentCard).getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(actions.undoAgentAction).toHaveBeenCalledWith(5));
  expect(within(screen.getByRole("article", { name: "Title gh:a:2" })).queryByText("by agent")).toBeNull();
});

test("app/applications/page.tsx imports no mutation helper", () => {
  const source = readFileSync("app/applications/page.tsx", "utf8");
  const imports = [...source.matchAll(/^import[^;]*?from\s+"([^"]+)"/gms)].map((m) => m[0]);
  for (const line of imports) {
    expect(line).not.toMatch(/setApplicationStage|addApplicationNote|setNextStep|appliedCore|withUserMutation|withUserPayloadMutation|@\/app\/actions\//);
  }
});
