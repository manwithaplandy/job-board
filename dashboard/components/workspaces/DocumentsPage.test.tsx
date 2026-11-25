// @vitest-environment jsdom
// The documents page (plan Task 1.11). The server actions and fetch are mocked.
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { GeneratedDocuments } from "@/lib/workspaces/generatedDocuments";
import type { ResumeVersion } from "@/lib/workspaces/resumeVersions";
import type { DocumentMeta } from "@/lib/workspaces/types";

const actions = vi.hoisted(() => ({
  deleteDocumentAction: vi.fn(),
  useAsResumeAction: vi.fn(),
  restoreResumeVersionAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/documents", () => ({
  deleteDocumentAction: actions.deleteDocumentAction,
  useAsResumeAction: actions.useAsResumeAction,
  restoreResumeVersionAction: actions.restoreResumeVersionAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));

import { DocumentsPage } from "./DocumentsPage";

const DOC_OK = "44444444-4444-4444-8444-444444444444";
const DOC_EMPTY = "55555555-5555-4555-8555-555555555555";

function doc(id: string, filename: string, extraction: DocumentMeta["extraction"]): DocumentMeta {
  return { id, kind: "other", filename, mime: "application/pdf", bytes: 20480, extraction, createdAt: "2026-11-24T00:00:00.000Z" };
}
const versions: ResumeVersion[] = [
  { version: 2, source: "upload", documentId: DOC_OK, text: "Earlier résumé two", createdAt: "2026-11-22T00:00:00.000Z" },
  { version: 1, source: "restore", documentId: null, text: "Earlier résumé one", createdAt: "2026-11-20T00:00:00.000Z" },
];
function generated(jobId: string, over: Partial<GeneratedDocuments> = {}): GeneratedDocuments {
  return {
    job: { jobId, title: `Title ${jobId}`, company: "Acme", location: null, remote: true, url: `https://jobs.example.com/${jobId}`, firstSeenAt: "2026-11-01T00:00:00.000Z", ageDays: 3, closed: false },
    status: "prepared",
    resume: true,
    cover: true,
    outdated: false,
    preparedAt: "2026-11-23T00:00:00.000Z",
    ...over,
  };
}

const props = () => ({
  resume: { text: "Current résumé text", updatedAt: "2026-11-24T00:00:00.000Z" },
  versions,
  documents: [doc(DOC_OK, "cv.pdf", "ok"), doc(DOC_EMPTY, "scan.pdf", "empty")],
  generated: [generated("a"), generated("b", { outdated: true, cover: false })],
});

beforeEach(() => {
  for (const fn of [actions.deleteDocumentAction, actions.useAsResumeAction, actions.restoreResumeVersionAction]) {
    fn.mockReset().mockResolvedValue({ ok: true });
  }
  actions.refresh.mockReset();
  vi.unstubAllGlobals();
});
afterEach(cleanup);

test("an upload with extraction 'empty' says the file had no readable text and cannot be used as the résumé", () => {
  render(<DocumentsPage {...props()} />);
  const empty = screen.getByRole("article", { name: "scan.pdf" });
  expect(empty.textContent).toContain("No readable text");
  expect(empty.textContent).toContain("cannot be used as your résumé");
  expect(within(empty).queryByRole("button", { name: "Use as résumé" })).toBeNull();
  const ok = screen.getByRole("article", { name: "cv.pdf" });
  expect(ok.textContent).toContain("Text read");
  expect(within(ok).getByRole("button", { name: "Use as résumé" })).toBeTruthy();
});

test("Use as résumé asks for confirmation before calling the action", async () => {
  render(<DocumentsPage {...props()} />);
  const ok = screen.getByRole("article", { name: "cv.pdf" });
  fireEvent.click(within(ok).getByRole("button", { name: "Use as résumé" }));
  expect(actions.useAsResumeAction).not.toHaveBeenCalled();
  expect(ok.textContent).toContain("Replace your résumé with the text from cv.pdf?");
  fireEvent.click(within(ok).getByRole("button", { name: "Cancel" }));
  expect(actions.useAsResumeAction).not.toHaveBeenCalled();
  fireEvent.click(within(ok).getByRole("button", { name: "Use as résumé" }));
  fireEvent.click(within(ok).getByRole("button", { name: "Replace résumé" }));
  await waitFor(() => expect(actions.useAsResumeAction).toHaveBeenCalledWith(DOC_OK));
  await waitFor(() => expect(actions.refresh).toHaveBeenCalled());
});

test("a refused replacement shows its message", async () => {
  actions.useAsResumeAction.mockResolvedValueOnce({ ok: false, message: "Résumé text is too long (max 50,000 characters)." });
  render(<DocumentsPage {...props()} />);
  const ok = screen.getByRole("article", { name: "cv.pdf" });
  fireEvent.click(within(ok).getByRole("button", { name: "Use as résumé" }));
  fireEvent.click(within(ok).getByRole("button", { name: "Replace résumé" }));
  expect(await screen.findByText("Résumé text is too long (max 50,000 characters).")).toBeTruthy();
  expect(actions.refresh).not.toHaveBeenCalled();
});

test("earlier résumé versions offer Restore after a confirmation", async () => {
  render(<DocumentsPage {...props()} />);
  const list = screen.getByRole("list", { name: "Earlier résumés" });
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0].textContent).toContain("Replaced when you used an upload");
  fireEvent.click(within(items[1]).getByRole("button", { name: "Restore" }));
  fireEvent.click(within(items[1]).getByRole("button", { name: "Restore this version" }));
  await waitFor(() => expect(actions.restoreResumeVersionAction).toHaveBeenCalledWith(1));
});

test("Delete asks first, then calls the action", async () => {
  render(<DocumentsPage {...props()} />);
  const empty = screen.getByRole("article", { name: "scan.pdf" });
  fireEvent.click(within(empty).getByRole("button", { name: "Delete" }));
  expect(actions.deleteDocumentAction).not.toHaveBeenCalled();
  fireEvent.click(within(empty).getByRole("button", { name: "Delete permanently" }));
  await waitFor(() => expect(actions.deleteDocumentAction).toHaveBeenCalledWith(DOC_EMPTY));
});

test("generated documents link to their job and show Outdated when the profile changed", () => {
  render(<DocumentsPage {...props()} />);
  const list = screen.getByRole("list", { name: "Generated documents" });
  const rows = within(list).getAllByRole("listitem");
  const link = within(rows[1]).getByRole("link", { name: "Title b" });
  expect(link.getAttribute("href")).toBe("https://jobs.example.com/b");
  expect(rows[1].textContent).toContain("Outdated");
  expect(rows[1].textContent).toContain("Résumé");
  expect(rows[1].textContent).not.toContain("Cover letter");
  expect(rows[0].textContent).not.toContain("Outdated");
  expect(rows[0].textContent).toContain("Cover letter");
});

test("uploading posts the chosen file to the upload route and refreshes", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: doc("x", "notes.md", "ok") }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<DocumentsPage {...props()} />);
  const input = screen.getByLabelText("Add a file") as HTMLInputElement;
  const file = new File(["hello"], "notes.md", { type: "text/markdown" });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/agent/upload");
  expect((init.body as FormData).get("file")).toBe(file);
  await waitFor(() => expect(actions.refresh).toHaveBeenCalled());
});

test("a refused upload shows the reason", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "type_mismatch" }), { status: 415 })));
  render(<DocumentsPage {...props()} />);
  fireEvent.change(screen.getByLabelText("Add a file"), { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  expect(await screen.findByText("That file's contents do not match its type.")).toBeTruthy();
});

test("app/documents/page.tsx imports no mutation helper", () => {
  const source = readFileSync("app/documents/page.tsx", "utf8");
  const imports = [...source.matchAll(/^import[^;]*?from\s+"([^"]+)"/gms)].map((m) => m[0]);
  for (const line of imports) {
    expect(line).not.toMatch(/deleteDocument|createDocument|setResumeFromDocument|restoreResumeVersion|withUserMutation|@\/app\/actions\//);
  }
});
