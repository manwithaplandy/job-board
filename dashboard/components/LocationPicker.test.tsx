// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocationPicker } from "./LocationPicker";

afterEach(cleanup);

const options = [
  { location: "London", count: 12 },
  { location: "New York, NY", count: 8 },
];

describe("LocationPicker", () => {
  test("stays expanded and announces an empty result set", () => {
    render(<LocationPicker name="preferred_locations" options={options} defaultValue={[]} />);
    const combobox = screen.getByRole("combobox");
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "nowhere" } });

    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("No matching locations");
  });

  test("renders each result as the interactive option without a nested button", () => {
    render(<LocationPicker name="preferred_locations" options={options} defaultValue={[]} />);
    fireEvent.focus(screen.getByRole("combobox"));

    const option = screen.getByRole("option", { name: /London/ });
    expect(option.querySelector("button")).toBeNull();
    fireEvent.mouseDown(option);
    expect((screen.getByDisplayValue('["London"]') as HTMLInputElement).name).toBe("preferred_locations");
  });

  test("makes chip removal accessible and touch-sized", () => {
    render(<LocationPicker name="preferred_locations" options={options} defaultValue={["London"]} />);
    const remove = screen.getByRole("button", { name: "Remove London" });
    expect(remove.classList.contains("location-chip-remove")).toBe(true);
  });

  test("dispatches bubbling input events only after user additions and removals", () => {
    const onInput = vi.fn();
    const { container } = render(
      <form onInput={onInput}>
        <LocationPicker name="preferred_locations" options={options} defaultValue={["London"]} />
      </form>,
    );
    const hidden = container.querySelector<HTMLInputElement>('input[name="preferred_locations"]')!;
    expect(onInput).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove London" }));
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput.mock.calls[0][0].target).toBe(hidden);

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByRole("option", { name: /London/ }));
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onInput.mock.calls[1][0].target).toBe(hidden);
  });

  test("exposes context-aware typography hooks for labels, inputs, options, and metadata", () => {
    render(<div className="profile-detail"><LocationPicker name="preferred_locations" options={options} defaultValue={["London"]} /></div>);
    expect(screen.getByText(/Locations to include/).classList).toContain("rf-picker-label");
    expect(screen.getByRole("combobox").classList).toContain("rf-picker-input");
    expect(screen.getByText("London").closest("li")?.classList).toContain("rf-picker-chip");
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: /New York/ }).classList).toContain("rf-picker-option");
  });
});
