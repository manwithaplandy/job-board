// @vitest-environment jsdom
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SectionSaveState } from "@/lib/profileSettingsState";
import { Field } from "./Field";
import { SectionFormShell } from "./SectionFormShell";
import { SettingsNav } from "./SettingsNav";
import { SettingsSectionCard } from "./SettingsSectionCard";

let pathname = "/profile/job-preferences";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const idleAction = async (): Promise<SectionSaveState> => ({ status: "idle" });

beforeEach(() => {
  pathname = "/profile/job-preferences";
  vi.restoreAllMocks();
});
afterEach(cleanup);

describe("shared settings primitives", () => {
  test("is pristine initially, becomes dirty from input, and has no serious accessibility violations", async () => {
    const { container } = render(
      <SectionFormShell action={idleAction} submitLabel="Save preferences">
        <Field id="instructions" name="instructions" label="Priorities" description="Used for matching">
          <textarea defaultValue="" />
        </Field>
      </SectionFormShell>,
    );

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save preferences" }).disabled).toBe(true);
    fireEvent.input(screen.getByLabelText("Priorities"), { target: { value: "backend" } });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save preferences" }).disabled).toBe(false);
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
  });

  test("tracks hidden and file controls through change events", () => {
    render(
      <SectionFormShell action={idleAction} submitLabel="Save">
        <input type="hidden" name="token" defaultValue="one" />
        <Field id="resume" name="resume" label="Résumé"><input type="file" /></Field>
      </SectionFormShell>,
    );
    const save = screen.getByRole("button", { name: "Save" });
    const hidden = document.querySelector<HTMLInputElement>('input[name="token"]')!;
    hidden.value = "two";
    fireEvent.change(hidden);
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((save as HTMLButtonElement).disabled).toBe(true);
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Résumé"), { target: { files: [file] } });
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });

  test("links field errors from the summary and focuses the first invalid field", async () => {
    const action = async (): Promise<SectionSaveState> => ({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { instructions: "Priorities are required." },
    });
    render(
      <SectionFormShell action={action} submitLabel="Save">
        <Field id="instructions" name="instructions" label="Priorities"><textarea defaultValue="" /></Field>
      </SectionFormShell>,
    );
    fireEvent.input(screen.getByLabelText("Priorities"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const field = await screen.findByLabelText("Priorities");
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toContain("instructions-error");
    expect(screen.getByRole("alert").querySelector('a[href="#instructions"]')).not.toBeNull();
  });

  test("announces success and establishes the submitted values as pristine", async () => {
    const action = async (): Promise<SectionSaveState> => ({ status: "success", savedAt: "2026-07-09T12:00:00Z" });
    render(
      <SectionFormShell action={action} submitLabel="Save">
        <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
      </SectionFormShell>,
    );
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Changes saved")).not.toBeNull();
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled).toBe(true));
  });

  test("keeps edits made while a save is pending dirty after that save succeeds", async () => {
    let resolve!: (state: SectionSaveState) => void;
    const action = () => new Promise<SectionSaveState>((done) => { resolve = done; });
    render(
      <SectionFormShell action={action} submitLabel="Save">
        <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
      </SectionFormShell>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Name");
    fireEvent.input(input, { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saving…");
    fireEvent.input(input, { target: { value: "Andrea" } });
    await act(async () => resolve({ status: "success", savedAt: "2026-07-10T12:00:00Z" }));
    await waitFor(() => expect(screen.queryByText("Changes saved")).toBeNull());
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled).toBe(false);
  });

  test("Cancel after a save restores the last saved values", async () => {
    const action = async (): Promise<SectionSaveState> => ({ status: "success", savedAt: "2026-07-10T12:00:00Z" });
    render(
      <SectionFormShell action={action} submitLabel="Save">
        <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
      </SectionFormShell>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Name");
    fireEvent.input(input, { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Changes saved");
    fireEvent.input(input, { target: { value: "Andrea" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(input.value).toBe("Andy");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled).toBe(true);
  });

  test("Cancel resets uncontrolled values and clears dirtiness", () => {
    render(
      <SectionFormShell action={idleAction} submitLabel="Save">
        <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
      </SectionFormShell>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Name");
    fireEvent.input(input, { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(input.value).toBe("Andrew");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled).toBe(true);
  });

  test("reports restored and successfully submitted baselines to controlled consumers", async () => {
    const onReset = vi.fn();
    const onSaved = vi.fn();
    const action = async (): Promise<SectionSaveState> => ({ status: "success", savedAt: "2026-07-10T12:00:00Z" });
    render(
      <SectionFormShell action={action} submitLabel="Save" onReset={onReset} onSaved={onSaved}>
        <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
      </SectionFormShell>,
    );
    const input = screen.getByLabelText<HTMLInputElement>("Name");
    fireEvent.input(input, { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onReset.mock.calls[0][0].get("name")).toBe("Andrew");
    fireEvent.input(input, { target: { value: "Andy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Changes saved");
    expect(onSaved.mock.calls[0][0].get("name")).toBe("Andy");
  });

  test("guards dirty same-origin link navigation but leaves external and modified clicks alone", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const stopNavigation = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", stopNavigation);
    render(
      <>
        <SectionFormShell action={idleAction} submitLabel="Save">
          <Field id="name" name="name" label="Name"><input defaultValue="Andrew" /></Field>
        </SectionFormShell>
        <a href="/profile/resume">Résumé</a>
        <a href="https://example.com">External</a>
        <a href="#details">Details</a>
        <a href={window.location.href}>Current</a>
        <a href="/profile/export" download>Download</a>
      </>,
    );
    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Andy" } });
    expect(fireEvent.click(screen.getByRole("link", { name: "Résumé" }))).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("link", { name: "External" }));
    fireEvent.click(screen.getByRole("link", { name: "Résumé" }), { metaKey: true });
    fireEvent.click(screen.getByRole("link", { name: "Details" }));
    fireEvent.click(screen.getByRole("link", { name: "Current" }));
    fireEvent.click(screen.getByRole("link", { name: "Download" }));
    expect(confirm).toHaveBeenCalledOnce();
    document.removeEventListener("click", stopNavigation);
  });

  test("marks the current settings destination and renders semantic cards", () => {
    render(
      <>
        <SettingsNav />
        <SettingsSectionCard title="Job preferences" status="Incomplete" summary="Tell us what fits" explanation="Used for matching." href="/profile/job-preferences" actionLabel="Review preferences" priority="primary" />
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Profile settings" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Job preferences" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("article").querySelector("h2")?.textContent).toBe("Job preferences");
    expect(screen.getByRole("link", { name: "Review preferences" }).getAttribute("href")).toBe("/profile/job-preferences");
  });

  test("maps server field names to distinct control IDs for summary links and focus", async () => {
    const action = async (): Promise<SectionSaveState> => ({
      status: "error",
      message: "Fix this field.",
      fieldErrors: { full_name: "Enter your name." },
    });
    render(
      <SectionFormShell action={action} submitLabel="Save">
        <Field id="account-full-name" name="full_name" label="Full name"><input defaultValue="" /></Field>
      </SectionFormShell>,
    );
    const field = screen.getByLabelText("Full name");
    fireEvent.input(field, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(summary.querySelector('a[href="#account-full-name"]')).not.toBeNull();
  });

  test("uses stable classes backed by 44px minimum targets at every viewport", () => {
    render(
      <>
        <SettingsNav />
        <SettingsSectionCard title="Account" status="Ready" summary="Manage it" explanation="Account settings." href="/profile/account" actionLabel="Open account" />
        <SectionFormShell action={idleAction} submitLabel="Save"><input name="value" defaultValue="" /></SectionFormShell>
      </>,
    );
    expect(screen.getByRole("navigation").querySelector("a")?.className).toContain("settings-nav-link");
    expect(screen.getByRole("link", { name: "Open account" }).className).toContain("settings-card-action");
    expect(screen.getByRole("button", { name: "Save" }).className).toContain("section-save");
    const css = readFileSync("app/profile/profile-settings.css", "utf8");
    expect(css).toMatch(/\.settings-nav-link[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.settings-card-action[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.profile-detail\s*\{[^}]*font-size:\s*16px/s);
    expect(css).toMatch(/\.profile-detail-header h1\s*\{[^}]*font-size:\s*(?:32px|2rem)/s);
    expect(css).toMatch(/\.settings-field label\s*\{[^}]*font-size:\s*16px/s);
    expect(css).toMatch(/\.field-description\s*\{[^}]*font-size:\s*14px/s);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.profile-detail-header h1\s*\{[^}]*font-size:\s*28px/s);
    expect(css).toMatch(/\.section-actions button[^}]*min-height:\s*44px/s);
  });
});
