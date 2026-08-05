// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// The panel is a server-seeded monitor; polling never starts here because every
// fixture row is terminal (no pending/running), so tests stay network-free.

vi.mock("@/app/actions/classification", () => ({ cancelClassificationJob: vi.fn() }));

import { ClassificationJobsPanel } from "./ClassificationJobsPanel";
import type { ClassificationJobRow } from "@/lib/classificationJobCodec";

// A real legacy row: pre-summarizer jobs stored the raw repr of an OpenRouter error,
// so the panel must contain blobs like this one (job 2, 2026-08-05) gracefully.
const LEGACY_BLOB =
  "all 500 classifications failed; sample: BadRequestError('Error code: 400 - " +
  "{'error': {'message': 'Provider returned error', 'code': 400, 'metadata': " +
  "{'raw': '{\\n \"error\": {\\n \"code\": 400,\\n \"message\": \"Request contains " +
  "an invalid argument.\",\\n \"status\": \"INVALID_ARGUMENT\"\\n }\\n}', " +
  "'provider_name': 'Google'}}}')";

function row(over: Partial<ClassificationJobRow> = {}): ClassificationJobRow {
  return {
    id: 1,
    status: "error",
    model: "google/gemini-3.5-flash-lite",
    companyCap: 500,
    selectionMode: "unclassified",
    useSerp: false,
    estCost: 0.57,
    processed: 0,
    errored: 500,
    serpQueries: 0,
    actualPromptTokens: 0,
    actualCompletionTokens: 0,
    actualCost: null,
    error: LEGACY_BLOB,
    createdAt: "2026-08-05T21:51:00Z",
    startedAt: "2026-08-05T21:51:30Z",
    finishedAt: "2026-08-05T21:54:30Z",
    ...over,
  };
}

afterEach(cleanup);

describe("ClassificationJobsPanel error display", () => {
  test("a long error is collapsed to a one-line summary with the full text behind a toggle", () => {
    const { container } = render(<ClassificationJobsPanel initial={[row()]} />);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();

    const summary = details!.querySelector("summary");
    expect(summary).not.toBeNull();
    // Truncated headline, not the whole blob: starts with the legible lead-in and
    // is ellipsized well short of the full 300+ chars.
    expect(summary!.textContent).toMatch(/^all 500 classifications failed/);
    expect(summary!.textContent!.length).toBeLessThan(120);
    expect(summary!.textContent).toMatch(/…$/);

    // The complete original error stays available for diagnosis.
    expect(details!.textContent).toContain("INVALID_ARGUMENT");
    expect(details!.textContent).toContain("provider_name");

    // jsdom supports the details activation behavior: clicking the summary opens it.
    fireEvent.click(summary!);
    expect(details!.open).toBe(true);
  });

  test("a short error renders as plain text with no toggle", () => {
    const short = "out of credits: monthly key limit exceeded";
    const { container } = render(
      <ClassificationJobsPanel initial={[row({ id: 2, error: short })]} />,
    );
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText(short)).toBeTruthy();
  });

  test("an errorless job renders no error block at all", () => {
    const { container } = render(
      <ClassificationJobsPanel
        initial={[row({ id: 3, status: "done", error: null, processed: 500, errored: 0 })]}
      />,
    );
    expect(container.querySelector("details")).toBeNull();
  });
});
