// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionFormShell } from "./SectionFormShell";
import type { SectionSaveState } from "@/lib/profileSettingsState";

afterEach(cleanup);

test("renders the upgrade CTA link to /billing when the action returns one", async () => {
  const action = async (): Promise<SectionSaveState> => ({
    status: "error",
    message: "Check the highlighted fields.",
    fieldErrors: { model_stage2: "Gemini Flash 3.5 requires the Pro plan." },
    upgrade: { href: "/billing", label: "Upgrade to Pro" },
  });
  render(
    <SectionFormShell action={action} submitLabel="Save">
      <input name="model_stage2" defaultValue="x" />
    </SectionFormShell>,
  );
  // Make the form dirty so the submit button enables, then submit.
  fireEvent.input(screen.getByDisplayValue("x"), { target: { value: "y" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const link = await screen.findByRole("link", { name: "Upgrade to Pro" });
  expect(link.getAttribute("href")).toBe("/billing");
});
