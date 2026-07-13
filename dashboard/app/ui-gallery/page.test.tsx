// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import PrimitiveGallery from "./page";

afterEach(cleanup);

test("renders every Phase 1 primitive in an independently reviewable gallery", () => {
  render(<PrimitiveGallery />);
  expect(screen.getByRole("heading", { name: "Rolefit primitive gallery" })).not.toBeNull();
  for (const section of ["Actions", "Icons", "Fields", "Cards and badges", "Navigation", "Page structure"]) {
    expect(screen.getByRole("heading", { name: section })).not.toBeNull();
  }
  expect(screen.getByRole("button", { name: "Use dark theme" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Use light theme" })).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Use light theme" }));
  expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  expect(document.querySelector('[data-gallery="rolefit-primitives"]')).not.toBeNull();
});
