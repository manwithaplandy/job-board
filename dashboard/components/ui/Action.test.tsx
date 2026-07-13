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

  test("requires an accessible action name and exposes size contracts", () => {
    render(<IconButton label="Close dialog" icon="close" size="sm" />);
    const button = screen.getByRole("button", { name: "Close dialog" });
    expect(button.className).toContain("rf-icon-button--sm");
    expect(button.className).toContain("rf-focusable");
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
