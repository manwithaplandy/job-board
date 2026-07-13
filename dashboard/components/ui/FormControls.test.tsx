// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { FileUpload, SelectField, TextArea, TextField } from "./FormControls";

afterEach(cleanup);

describe("form controls", () => {
  test("associates labels, descriptions, and errors with text inputs", () => {
    render(<TextField id="full-name" label="Full name" description="Shown to employers" error="Enter your name" />);
    const input = screen.getByLabelText("Full name");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("full-name-description full-name-error");
    expect(input.className).toContain("rf-focusable");
    expect(screen.getByText("Enter your name").getAttribute("role")).toBe("alert");
  });

  test("labels textarea, select, and file upload controls", () => {
    render(
      <>
        <TextArea id="summary" label="Summary" />
        <SelectField id="seniority" label="Seniority"><option>Senior</option></SelectField>
        <FileUpload id="resume" label="Résumé" accept=".pdf" />
      </>,
    );
    expect(screen.getByLabelText("Summary").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Seniority").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Résumé").getAttribute("type")).toBe("file");
  });
});
