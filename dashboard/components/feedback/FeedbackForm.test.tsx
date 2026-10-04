// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
const submit = vi.hoisted(() => vi.fn());
vi.mock("@/app/feedback/actions", () => ({submitFeedback: submit}));
import { FeedbackForm } from "./FeedbackForm";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
test("labels fields and announces successful feedback", async () => {
  submit.mockResolvedValue({ok: true}); render(<FeedbackForm />);
  fireEvent.change(screen.getByLabelText(/Message/), {target:{value:"The filters need work"}});
  fireEvent.change(screen.getByLabelText(/Feedback type/), {target:{value:"criticism"}});
  fireEvent.click(screen.getByRole("button", {name:"Send feedback"}));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Thank you"));
  expect(submit).toHaveBeenCalledWith({kind:"criticism", message:"The filters need work"});
});
test("preserves text and announces submission errors", async () => {
  submit.mockResolvedValue({ok:false,error:"Please try again later."}); render(<FeedbackForm />);
  fireEvent.change(screen.getByLabelText(/Message/), {target:{value:"Keep my draft"}});
  fireEvent.click(screen.getByRole("button", {name:"Send feedback"}));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Please try again later."));
  expect((screen.getByLabelText(/Message/) as HTMLTextAreaElement).value).toBe("Keep my draft");
});
