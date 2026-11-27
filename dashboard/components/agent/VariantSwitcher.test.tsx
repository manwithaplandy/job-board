// @vitest-environment jsdom
// The per-thread variant switcher (plan Task 2.8). The server actions are mocks; their own
// checks (plan, variant 3 switch, thread ownership) are app/actions/agent.test.ts.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ setThreadVariantAction: vi.fn(), setDefaultVariantAction: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import { VARIANT3_OFF_NOTE } from "@/lib/agent/variants";
import { SWITCHER_APPLIES, SWITCHER_FAILED, SWITCHER_LABEL, VariantSwitcher, type VariantsState } from "./VariantSwitcher";

const THREAD = "22222222-2222-4222-8222-222222222222";

function mount(state: Partial<VariantsState> = {}) {
  return render(<VariantSwitcher threadId={THREAD} state={{ thread: 1, default: 1, variant3Enabled: true, ...state }} />);
}

const option = (name: string) => screen.getByRole("radio", { name });

beforeEach(() => {
  actions.setThreadVariantAction.mockReset().mockResolvedValue({ ok: true });
  actions.setDefaultVariantAction.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

test("all three options are offered; the thread's variant is checked", () => {
  mount({ thread: 2 });
  expect(screen.getByRole("radiogroup", { name: SWITCHER_LABEL })).toBeTruthy();
  for (const name of ["Blocks", "Layout", "Code"]) expect((option(name) as HTMLButtonElement).disabled).toBe(false);
  expect(option("Layout").getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByText(VARIANT3_OFF_NOTE)).toBeNull();
});

test("picking an option stores it for this thread and says it applies from the next message", async () => {
  mount();
  fireEvent.click(option("Code"));
  expect(actions.setThreadVariantAction).toHaveBeenCalledWith(THREAD, 3);
  expect(option("Code").getAttribute("aria-checked")).toBe("true");
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe(SWITCHER_APPLIES));
  // Picking the checked option again writes nothing.
  fireEvent.click(option("Code"));
  expect(actions.setThreadVariantAction).toHaveBeenCalledTimes(1);
});

test("a refused change puts the old option back", async () => {
  actions.setThreadVariantAction.mockResolvedValue({ ok: false, reason: "no_plan" });
  mount();
  fireEvent.click(option("Layout"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe(SWITCHER_FAILED));
  expect(option("Blocks").getAttribute("aria-checked")).toBe("true");
});

test("with variant 3 switched off, option 3 is disabled with the fixed note and a variant 3 thread shows as variant 1", () => {
  mount({ thread: 3, variant3Enabled: false });
  expect((option("Code") as HTMLButtonElement).disabled).toBe(true);
  expect(option("Blocks").getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText(VARIANT3_OFF_NOTE)).toBeTruthy();
  fireEvent.click(option("Code"));
  expect(actions.setThreadVariantAction).not.toHaveBeenCalled();
});

test("there is no separate default button: a pick carries over to new conversations by itself", () => {
  mount({ thread: 2, default: 1 });
  expect(screen.queryByRole("button")).toBeNull();
});
