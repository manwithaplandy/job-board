// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PayRangeSlider } from "./PayRangeSlider";

afterEach(cleanup);

function setup(overrides: Partial<ComponentProps<typeof PayRangeSlider>> = {}) {
  const onChange = vi.fn();
  const onToggleUndisclosed = vi.fn();
  render(
    <PayRangeSlider
      min={0}
      max={null}
      includeUndisclosed={false}
      onChange={onChange}
      onToggleUndisclosed={onToggleUndisclosed}
      {...overrides}
    />,
  );
  return { onChange, onToggleUndisclosed };
}

describe("PayRangeSlider", () => {
  test("renders both range handles and the include toggle", () => {
    setup();
    expect(screen.getByLabelText("Minimum pay")).toBeTruthy();
    expect(screen.getByLabelText("Maximum pay")).toBeTruthy();
    expect(screen.getByLabelText("Include jobs without listed pay")).toBeTruthy();
  });

  test("dragging the min handle emits the new floor, top stays unbounded", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Minimum pay"), { target: { value: "80" } });
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("dragging the max handle below the ceiling emits a numeric ceiling", () => {
    const { onChange } = setup({ min: 80 });
    fireEvent.change(screen.getByLabelText("Maximum pay"), { target: { value: "120" } });
    expect(onChange).toHaveBeenLastCalledWith(80, 120);
  });

  test("max handle at the ceiling emits null (the '+' state)", () => {
    const { onChange } = setup({ min: 80, max: 200 });
    fireEvent.change(screen.getByLabelText("Maximum pay"), { target: { value: "400" } });
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("min handle cannot cross above the max handle", () => {
    const { onChange } = setup({ min: 80, max: 120 });
    fireEvent.change(screen.getByLabelText("Minimum pay"), { target: { value: "300" } });
    expect(onChange).toHaveBeenLastCalledWith(120, 120);
  });

  test("typing into the max field and blurring commits it", () => {
    const { onChange } = setup({ min: 80 });
    const field = screen.getByLabelText("Maximum pay, in thousands");
    fireEvent.change(field, { target: { value: "150k" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith(80, 150);
  });

  test("clearing the max field means unbounded (+)", () => {
    const { onChange } = setup({ min: 80, max: 150 });
    const field = screen.getByLabelText("Maximum pay, in thousands");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenLastCalledWith(80, null);
  });

  test("toggling the checkbox reports the new state", () => {
    const { onToggleUndisclosed } = setup();
    fireEvent.click(screen.getByLabelText("Include jobs without listed pay"));
    expect(onToggleUndisclosed).toHaveBeenCalledWith(true);
  });
});
