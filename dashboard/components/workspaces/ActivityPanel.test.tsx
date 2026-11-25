// @vitest-environment jsdom
// The agent activity panel (plan Task 1.20, spec 6.7) and its reader.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ undoAgentAction: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const db = vi.hoisted(() => ({ actions: [] as unknown[], jobs: [] as unknown[] }));
vi.mock("@/lib/agent/actions/audit", () => ({ listRecentActions: vi.fn(async () => db.actions) }));
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn(async (_u: string, fn: (tx: unknown) => unknown) => fn(async () => db.jobs)) }));

import { ActivityPanel } from "./ActivityPanel";
import { ACTIVITY_LABELS, listActivity, type ActivityItem } from "@/lib/workspaces/activity";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB = "greenhouse:acme:101";

beforeEach(() => {
  actions.undoAgentAction.mockReset().mockResolvedValue({ ok: true });
  router.refresh.mockReset();
  db.actions = [];
  db.jobs = [];
});
afterEach(cleanup);

test("the activity panel lists agent and unattended actions newest first and Undo calls undoAgentAction", async () => {
  // listRecentActions answers newest first; a press the user made on a surface is not the agent's.
  db.actions = [
    { id: 9, kind: "shortlist.set", actor: "agent_unattended", targetKey: { jobId: JOB }, before: null, after: null, undoneAt: null, createdAt: "2026-11-25T10:00:00.000Z" },
    { id: 8, kind: "shortlist.set", actor: "user_via_surface", targetKey: { jobId: JOB }, before: null, after: null, undoneAt: null, createdAt: "2026-11-25T09:30:00.000Z" },
    { id: 7, kind: "analytics.set_tiles", actor: "agent", targetKey: { version: 3 }, before: null, after: null, undoneAt: "2026-11-25T09:10:00.000Z", createdAt: "2026-11-25T09:00:00.000Z" },
  ];
  db.jobs = [{ id: JOB, title: "Engineer", company: "Acme" }];
  const items = await listActivity(USER);
  expect(items).toEqual([
    { id: 9, label: ACTIVITY_LABELS["shortlist.set"], subject: "Engineer at Acme", unattended: true, undone: false, createdAt: "2026-11-25T10:00:00.000Z" },
    { id: 7, label: ACTIVITY_LABELS["analytics.set_tiles"], subject: null, unattended: false, undone: true, createdAt: "2026-11-25T09:00:00.000Z" },
  ]);

  render(<ActivityPanel items={items} />);
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText("Engineer at Acme")).toBeTruthy();
  expect(within(rows[0]).getByText("While you were away")).toBeTruthy();
  expect(within(rows[1]).getByText("Undone")).toBeTruthy();
  expect(within(rows[1]).queryByRole("button", { name: "Undo" })).toBeNull();
  fireEvent.click(within(rows[0]).getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(actions.undoAgentAction).toHaveBeenCalledWith(9));
  await waitFor(() => expect(within(rows[0]).getByText("Undone")).toBeTruthy());
  expect(router.refresh).toHaveBeenCalled();
});

test("an undo refusal shows its fixed line and keeps the row", async () => {
  actions.undoAgentAction.mockResolvedValue({ ok: false, reason: "changed_since" });
  const item: ActivityItem = { id: 3, label: "Moved a job on your shortlist", subject: null, unattended: false, undone: false, createdAt: "2026-11-25T10:00:00.000Z" };
  render(<ActivityPanel items={[item]} />);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(await screen.findByText("This changed since")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
});

test("a failed read and an empty log each show a fixed line, collapsed by default", () => {
  const { container, rerender } = render(<ActivityPanel items={null} />);
  expect(container.querySelector("details")?.hasAttribute("open")).toBe(false);
  expect(screen.getByText("Activity could not be loaded. Reload the page to try again.")).toBeTruthy();
  rerender(<ActivityPanel items={[]} />);
  expect(screen.getByText("The agent has not changed anything yet.")).toBeTruthy();
});
