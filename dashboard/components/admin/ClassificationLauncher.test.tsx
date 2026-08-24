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

// Empty model catalog → pricing resolves from FALLBACK_PRICING, so the estimate is
// deterministic without a live OpenRouter fetch. NOTE the default model (ox-alpha) is
// priced at $0/token, so any assertion that needs a NON-zero dollar figure must first
// switch the Model select to a paid entry — see the target-count-cap test below.
const COUNTS = { unclassified: 10_000, unknownRepass: 500, all: 29_412 };

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
    // ox-alpha (default) is $0/token, so the delta is the Serper query fee alone:
    //   (900*0 + SERP_QUERY_COST_USD) * 1000 = $1.00 per 1,000 companies. The point of
    // the per-1,000 scaling is that a per-COMPANY figure would cent-round to $0.00.
    const label = screen.getByText(/per 1,000 companies/i);
    expect(label.textContent).toContain("$1.00");
    expect(label.textContent).not.toContain("$0.00");
  });

  test("caps the estimate at the available target count for the chosen mode", () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    // The default model is free, which would make every estimate "$0.00" and hide the
    // cap entirely — switch to a paid model so the clamp is observable in dollars.
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "google/gemini-3.5-flash-lite" },
    });
    // Default mode 'unclassified' has 10,000 targets; cap 500 → estimate at 500.
    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "50000" } });
    const cappedAt10k = estimateText();
    // Re-pass mode has only 500 targets, so the same 50000 cap estimates at 500.
    fireEvent.click(screen.getByRole("radio", { name: /Re-pass/i }));
    const cappedAt500 = estimateText();
    expect(cappedAt500).not.toBe(cappedAt10k);
  });

  test("the 'Everything' mode targets the whole corpus", async () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    fireEvent.click(screen.getByRole("radio", { name: /Everything/i }));
    // Raise the cap past the corpus so the clamp — not the typed cap — sets the hint.
    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "50000" } });
    expect(screen.getByText(/for 29,412 companies/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Launch classification" }));
    await waitFor(() =>
      expect(action.launchClassificationJob).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "all", model: "stealth/ox-alpha" }),
      ),
    );
  });

  test("launches with the selected configuration", async () => {
    render(<ClassificationLauncher models={[]} counts={COUNTS} />);
    fireEvent.change(screen.getByLabelText("Company cap"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /web search/i }));
    fireEvent.click(screen.getByRole("button", { name: "Launch classification" }));
    await waitFor(() =>
      expect(action.launchClassificationJob).toHaveBeenCalledWith({
        model: "stealth/ox-alpha",
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
