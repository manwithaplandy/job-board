// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The launcher is a thin client shell over launchClassificationJob: assert on the
// live ROM estimate (recomputed client-side from the passed-down pricing) and the
// config handed to the (mocked) action — never real network (jsdom convention).

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: nav.refresh }) }));

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const action = vi.hoisted(() => ({
  launchClassificationJob: vi.fn<
    (input: unknown) => Promise<{ ok: boolean; error?: string }>
  >(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/classification", () => action);

import { ClassificationLauncher } from "./ClassificationLauncher";

// Empty model catalog → pricing resolves from FALLBACK_PRICING (Flash-Lite present),
// so the estimate is deterministic without a live OpenRouter fetch.
const COUNTS = { unclassified: 10_000, unknownRepass: 500 };

afterEach(() => {
  cleanup();
  nav.refresh.mockClear();
  toast.error.mockClear();
  action.launchClassificationJob.mockReset();
  action.launchClassificationJob.mockResolvedValue({ ok: true });
});

function estimateText(): string {
  return screen.getByTestId("classification-estimate").textContent ?? "";
}

describe("ClassificationLauncher", () => {
  test("renders a dollar estimate that moves when SERP is toggled and the cap changes", () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    const base = estimateText();
    expect(base).toContain("$");

    fireEvent.click(screen.getByRole("checkbox", { name: /web search/i }));
    const withSerp = estimateText();
    expect(withSerp).not.toBe(base);

    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "100" } });
    expect(estimateText()).not.toBe(withSerp);
  });

  test("shows the SERP delta scaled per 1,000 companies (not a cent-rounded per-company $0.00)", () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    // Flash-Lite fallback: (EST_SERP_EXTRA_INPUT_TOKENS*0.30e-6 + SERP_QUERY_COST_USD) * 1000
    //   = (900*0.30e-6 + 0.001) * 1000 = $1.27 per 1,000 companies.
    const label = screen.getByText(/per 1,000 companies/i);
    expect(label.textContent).toContain("$1.27");
    expect(label.textContent).not.toContain("$0.00");
  });

  test("caps the estimate at the available target count for the chosen mode", () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    // Default mode 'unclassified' has 10,000 targets; cap 500 → estimate at 500.
    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "50000" } });
    const cappedAt10k = estimateText();
    // Re-pass mode has only 500 targets, so the same 50000 cap estimates at 500.
    fireEvent.click(screen.getByRole("radio", { name: /Re-pass/i }));
    const cappedAt500 = estimateText();
    expect(cappedAt500).not.toBe(cappedAt10k);
  });

  test("launches with the selected configuration", async () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /web search/i }));
    fireEvent.click(screen.getByRole("button", { name: "Launch classification" }));
    await waitFor(() =>
      expect(action.launchClassificationJob).toHaveBeenCalledWith({
        model: "google/gemini-3.5-flash-lite",
        cap: 250,
        mode: "unclassified",
        useSerp: true,
      }),
    );
    expect(nav.refresh).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("surfaces an { ok:false } result as a toast and does not refresh", async () => {
    action.launchClassificationJob.mockResolvedValueOnce({ ok: false, error: "Cap too large." });
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Launch classification" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cap too large."));
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
