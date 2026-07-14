// @vitest-environment jsdom

import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VisualBoardState } from "./VisualBoardState";

afterEach(cleanup);

describe("production-backed visual board stories", () => {
  test("generation story renders the production busy state and cancellation action", () => {
    const { container } = render(<VisualBoardState state="generation" />);

    expect(screen.getByText(/Tailoring your résumé to Acme Systems/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(container.querySelector(".rf-generation-panel__row")).toBeTruthy();
  });
});
