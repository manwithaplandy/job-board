// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Icon } from "./Icon";
import { IconButton } from "./Action";

afterEach(cleanup);

describe("icon actions", () => {
  test("keeps decorative icons hidden and labels standalone icons", () => {
    const { container } = render(
      <>
        <Icon name="check" />
        <Icon name="warning" label="Warning" size={20} />
      </>,
    );
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: "Warning" }).getAttribute("width")).toBe("20");
  });

  test("requires an accessible action name and implements distinct visual sizes", () => {
    render(<><IconButton label="Compact close" icon="close" size="sm" /><IconButton label="Standard close" icon="close" size="md" /></>);
    const compact = screen.getByRole("button", { name: "Compact close" });
    const standard = screen.getByRole("button", { name: "Standard close" });
    expect(compact.querySelector("svg")?.getAttribute("width")).toBe("16");
    expect(standard.querySelector("svg")?.getAttribute("width")).toBe("18");
    expect(compact.getAttribute("data-visual-size")).toBe("36");
    expect(standard.getAttribute("data-visual-size")).toBe("44");
  });
});
