// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SectionSaveState } from "@/lib/profileSettingsState";
import { DangerZone } from "@/components/account/DangerZone";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppearanceToggle } from "@/components/theme/AppearanceToggle";
import { Field } from "./Field";
import { SectionFormShell } from "./SectionFormShell";
import { SettingsSectionCard } from "./SettingsSectionCard";

vi.mock("@/app/actions/account", () => ({ deleteMyAccount: vi.fn() }));

const profileRoot = resolve(process.cwd());
const source = (file: string) => readFileSync(resolve(profileRoot, file), "utf8");

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(cleanup);

describe("profile design-system convergence", () => {
  test("all detail routes compose the shared page header", () => {
    for (const file of [
      "app/profile/account/page.tsx",
      "app/profile/advanced/page.tsx",
      "app/profile/application-details/page.tsx",
      "app/profile/application-personalization/page.tsx",
      "app/profile/job-preferences/page.tsx",
      "app/profile/resume/page.tsx",
    ]) {
      expect(source(file), file).toContain("<PageHeader");
      expect(source(file), file).not.toContain("profile-detail-header");
    }
  });

  test("profile settings use shared cards, controls, actions, and no inline presentation", () => {
    for (const file of [
      "components/profile/AccountSettings.tsx",
      "components/profile/AdvancedAiForm.tsx",
      "components/profile/ApplicationDetailsForm.tsx",
      "components/profile/ApplicationPersonalizationForm.tsx",
      "components/profile/JobPreferencesForm.tsx",
      "components/profile/ProfileHub.tsx",
      "components/profile/ResumeSettingsForm.tsx",
      "components/profile/SettingsSectionCard.tsx",
      "components/account/DangerZone.tsx",
      "components/theme/AppearanceToggle.tsx",
    ]) {
      expect(source(file), file).not.toMatch(/\sstyle=\{/);
    }
    expect(source("components/profile/SettingsSectionCard.tsx")).toContain("<Card");
    expect(source("components/profile/SettingsSectionCard.tsx")).toContain("<Badge");
    expect(source("components/profile/SettingsSectionCard.tsx")).toContain("<ButtonLink");
    expect(source("components/account/DangerZone.tsx")).toContain("<TextField");
    expect(source("components/account/DangerZone.tsx")).toContain("<ButtonLink");
    expect(source("components/theme/AppearanceToggle.tsx")).toContain("<SegmentedControl");
  });

  test("field adapter and form shell expose the shared typography, control, card, error, and action roles", async () => {
    const action = async (): Promise<SectionSaveState> => ({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { name: "Enter a name." },
    });
    const { container } = render(
      <SectionFormShell action={action} submitLabel="Save details">
        <section className="profile-form-section" aria-labelledby="identity-heading">
          <h2 id="identity-heading">Identity</h2>
          <Field id="name" name="name" label="Name" description="Shown on applications">
            <input defaultValue="" />
          </Field>
        </section>
      </SectionFormShell>,
    );
    const field = screen.getByLabelText("Name");
    expect(field.classList).toContain("rf-control");
    expect(field.closest(".rf-field")).not.toBeNull();
    expect(container.querySelector("form")?.classList).toContain("profile-section-form");
    expect(container.querySelector(".profile-form-section")).not.toBeNull();
    fireEvent.input(field, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    const alert = await screen.findByRole("alert");
    expect(alert.classList).toContain("profile-error-summary");
    expect(alert.querySelector("a")?.classList).toContain("rf-focusable");
    expect(screen.getByRole("group", { name: "Form actions" }).classList).toContain("profile-action-bar");
  });

  test("overview, appearance, export, and destructive actions render shared contracts", () => {
    render(
      <>
        <SettingsSectionCard title="Résumé" status="Ready" summary="Current" explanation="Used for matching." href="/profile/resume" actionLabel="Review résumé" />
        <ThemeProvider><AppearanceToggle /></ThemeProvider>
        <DangerZone />
      </>,
    );
    expect(screen.getByRole("article").classList).toContain("rf-card");
    expect(screen.getByText("Ready").classList).toContain("rf-badge");
    expect(screen.getByRole("link", { name: "Review résumé" }).classList).toContain("rf-button");
    expect(screen.getByRole("radiogroup", { name: "Theme" }).classList).toContain("rf-segments");
    expect(screen.getByRole("link", { name: "Export my data" }).classList).toContain("rf-button");
    expect(screen.getByRole("textbox", { name: /confirm account deletion/i }).classList).toContain("rf-control");
    expect(screen.getByRole("button", { name: "Delete account" }).classList).toContain("rf-button--destructive");
  });

  test("profile CSS defines token-based page rhythm and a single-column mobile contract", () => {
    const css = source("app/profile/profile-settings.css");
    expect(css).toContain(".profile-page-stack");
    expect(css).toContain(".profile-form-section");
    expect(css).toContain(".profile-action-bar");
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.settings-card-grid[^}]*grid-template-columns:\s*1fr/);
    expect(css).not.toMatch(/padding:\s*22px/);
    expect(css).not.toMatch(/border-radius:\s*16px/);
  });
});
