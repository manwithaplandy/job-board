// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  test("merges consumer descriptions while errors remain authoritative for every control", () => {
    render(
      <>
        <div id="external">External help</div>
        <TextField id="name" label="Name" description="Name help" error="Name error" aria-describedby="external" aria-invalid="false" />
        <TextArea id="bio" label="Bio" description="Bio help" error="Bio error" aria-describedby="external" aria-invalid="false" />
        <SelectField id="level" label="Level" description="Level help" error="Level error" aria-describedby="external" aria-invalid="false"><option>Senior</option></SelectField>
        <FileUpload id="cv" label="CV" description="CV help" error="CV error" aria-describedby="external" aria-invalid="false" />
      </>,
    );
    for (const id of ["name", "bio", "level", "cv"]) {
      const control = document.getElementById(id)!;
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toBe(`external ${id}-description ${id}-error`);
    }
  });

  test("announces the selected filename and preserves the consumer change handler", () => {
    let changed = false;
    render(<FileUpload id="resume-file" label="Résumé file" onChange={() => { changed = true; }} />);
    const input = document.getElementById("resume-file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["resume"], "andrew-resume.pdf", { type: "application/pdf" })] } });
    expect(changed).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("andrew-resume.pdf");
  });
});
