// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModelPicker } from "./ModelPicker";

afterEach(cleanup);

const models = [
  { id: "openai/example", name: "Example", pricing: { prompt: "", completion: "" } },
  { id: "anthropic/other", name: "Other", pricing: { prompt: "", completion: "" } },
];

function picker() {
  return <ModelPicker label="Résumé model" name="model_resume" models={models}
    curated={models.map((model) => model.id)} defaultValue={null} placeholder="Example" />;
}

describe("ModelPicker", () => {
  test("stays expanded and announces an empty result set", () => {
    render(picker());
    const combobox = screen.getByRole("combobox");
    fireEvent.focus(combobox);
    fireEvent.change(combobox, { target: { value: "nowhere" } });

    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain("No matching models");
  });

  test("renders each result as the interactive option without a nested button", () => {
    render(picker());
    fireEvent.focus(screen.getByRole("combobox"));

    const option = screen.getByRole("option", { name: /Example/ });
    expect(option.querySelector("button")).toBeNull();
    fireEvent.mouseDown(option);
    expect((document.querySelector('input[name="model_resume"]') as HTMLInputElement).value)
      .toBe("openai/example");
  });

  test("dispatches a bubbling input event from the hidden field after selection", () => {
    const onInput = vi.fn();
    const { container } = render(<form onInput={onInput}>{picker()}</form>);
    const hidden = container.querySelector<HTMLInputElement>('input[name="model_resume"]')!;
    expect(onInput).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByRole("option", { name: /Example/ }));
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput.mock.calls[0][0].target).toBe(hidden);
  });

  test("clears a saved selection and dispatches one bubbling input event from the hidden field", () => {
    const onInput = vi.fn();
    const { container } = render(
      <form onInput={onInput}>
        <ModelPicker label="Résumé model" name="model_resume" models={models}
          curated={models.map((model) => model.id)} defaultValue="openai/example"
          placeholder="Example" />
      </form>,
    );
    const hidden = container.querySelector<HTMLInputElement>('input[name="model_resume"]')!;
    expect(hidden.value).toBe("openai/example");
    expect(onInput).not.toHaveBeenCalled();

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: "Clear model (use default)" }));

    expect(hidden.value).toBe("");
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput.mock.calls[0][0].target).toBe(hidden);
  });
});
