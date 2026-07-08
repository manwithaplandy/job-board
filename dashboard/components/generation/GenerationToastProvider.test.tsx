// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { GenerationToastProvider, useGenerationTracker } from "./GenerationToastProvider";
import { OPEN_JOB_EVENT, type GenerationJobView } from "@/lib/generationJobCodec";
import { NOTIFIED_STORAGE_KEY } from "@/lib/generationNotifications";

// The provider's contract: poll /api/generations while pending, toast each settle
// exactly once (localStorage de-dupe), deep-link View to the job, expose pending +
// a settled feed, and go inert for anonymous viewers (redirected poll).

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));
// Stable router object — the real useRouter is referentially stable across
// renders, and the provider's callback chain relies on that.
const routerStub = { push: mocks.routerPush };
vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
}));

const pendingJob = (over: Partial<GenerationJobView> = {}): GenerationJobView => ({
  id: "gen-1",
  jobId: "ashby:acme:1",
  kind: "resume",
  status: "pending",
  error: null,
  jobTitle: "Engineer",
  company: "Acme",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  ...over,
});

// A single mutable "next response" the mocked fetch returns; tests set it before
// advancing timers to drive the poller through its transitions.
let nextGenerations: GenerationJobView[] = [];
let nextRedirected = false;

// Probe rendered inside the provider: exposes pending/feed counts + notifyStarted.
function Probe() {
  const tracker = useGenerationTracker();
  return (
    <div>
      <output data-testid="pending">{tracker?.pending.map((j) => j.id).join(",") ?? ""}</output>
      <output data-testid="feed">
        {tracker?.settledFeed ? `${tracker.settledFeed.seq}:${tracker.settledFeed.jobs.map((j) => `${j.id}=${j.status}`).join(",")}` : ""}
      </output>
      <button type="button" onClick={() => tracker?.notifyStarted(pendingJob({ id: "gen-local" }))}>
        start
      </button>
    </div>
  );
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderProvider() {
  return render(
    <GenerationToastProvider>
      <Probe />
    </GenerationToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks(); // the hoisted toast/router fns persist across tests
  vi.useFakeTimers();
  localStorage.clear();
  nextGenerations = [];
  nextRedirected = false;
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    redirected: nextRedirected,
    json: async () => ({ generations: nextGenerations }),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe("GenerationToastProvider", () => {
  test("resumes from server state on mount and polls until the settle, then toasts once", async () => {
    nextGenerations = [pendingJob()];
    renderProvider();
    await flush(0); // initial poll
    expect(screen.getByTestId("pending").textContent).toBe("gen-1");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();

    nextGenerations = [pendingJob({ status: "ready", updatedAt: "2026-07-05T00:01:00.000Z" })];
    await flush(4_000); // next tick observes the settle
    expect(screen.getByTestId("pending").textContent).toBe("");
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess.mock.calls[0][0]).toBe("Résumé ready · Acme");
    // The tab observed pending→ready, so the board feed carries it.
    expect(screen.getByTestId("feed").textContent).toBe("1:gen-1=ready");

    // Nothing pending → polling stops (no further fetches on later ticks).
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await flush(12_000);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });

  test("a settle is toasted exactly once across polls AND across remounts (localStorage)", async () => {
    nextGenerations = [pendingJob()];
    renderProvider();
    await flush(0);
    nextGenerations = [pendingJob({ status: "ready" })];
    await flush(4_000);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);

    // Remount (reload simulation): the settled row is still in the server window,
    // but localStorage already records the toast.
    cleanup();
    renderProvider();
    await flush(0);
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(NOTIFIED_STORAGE_KEY)).toContain("gen-1");
  });

  test("a client that was away still toasts a recently-settled generation it never saw pending", async () => {
    nextGenerations = [pendingJob({ status: "failed", error: "Résumé generation timed out — please try again." })];
    renderProvider();
    await flush(0);
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0][0]).toBe("Résumé generation failed · Acme");
    expect(mocks.toastError.mock.calls[0][1].description).toContain("timed out");
    // No pending→settled transition was observed, so the board feed stays empty
    // (its server-loaded state is already final).
    expect(screen.getByTestId("feed").textContent).toBe("");
  });

  test("a partially-ready prepare (note in error) surfaces as a warning toast", async () => {
    nextGenerations = [pendingJob({ kind: "prepare", status: "ready", error: "Couldn’t generate the cover letter — you can retry it from the job pane." })];
    renderProvider();
    await flush(0);
    expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
    expect(mocks.toastWarning.mock.calls[0][0]).toBe("Application prefilled · Acme");
  });

  test("View action: an unclaimed event deep-links via router.push; a claiming listener wins", async () => {
    nextGenerations = [pendingJob({ status: "ready" })];
    renderProvider();
    await flush(0);
    const action = mocks.toastSuccess.mock.calls[0][1].action as { label: string; onClick: () => void };
    expect(action.label).toBe("View");

    // No mounted board → falls back to the ?job= deep link.
    act(() => action.onClick());
    expect(mocks.routerPush).toHaveBeenCalledWith("/?job=ashby%3Aacme%3A1");

    // A mounted board claims the event via preventDefault → no navigation.
    mocks.routerPush.mockClear();
    const claim = (e: Event) => e.preventDefault();
    window.addEventListener(OPEN_JOB_EVENT, claim);
    try {
      act(() => action.onClick());
      expect(mocks.routerPush).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(OPEN_JOB_EVENT, claim);
    }
  });

  test("notifyStarted shows pending immediately and kicks a poll", async () => {
    renderProvider();
    await flush(0); // initial poll (empty)
    const before = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      fireEvent.click(screen.getByText("start"));
      await vi.advanceTimersByTimeAsync(0);
    });
    // Optimistic row survives the immediate poll that doesn't include it yet.
    expect(screen.getByTestId("pending").textContent).toBe("gen-local");
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before);
  });

  test("anonymous viewer (redirected poll) disables polling until a notifyStarted", async () => {
    nextRedirected = true;
    renderProvider();
    await flush(0);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    await flush(20_000);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
