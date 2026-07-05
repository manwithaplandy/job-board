import { beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/resume/extract burns LLM tokens, so it has a budget-abuse gate: the caller
// must be INVITED (invite_redemptions) OR already have a profile — a direct-API account
// that skipped /signup can authenticate but must not spend budget. The converter
// (fileToResumeMarkdown) is the PDF-parse boundary (its own tests cover internals).
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  isInvitedUser: vi.fn(),
  getProfile: vi.fn(),
  fileToResumeMarkdown: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getUserClaims: mocks.getUserClaims }));
vi.mock("@/lib/invites", () => ({ isInvitedUser: mocks.isInvitedUser }));
vi.mock("@/lib/queries", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/rolefit/fileToResumeMarkdown", () => ({ fileToResumeMarkdown: mocks.fileToResumeMarkdown }));

import { POST } from "@/app/api/resume/extract/route";

const USER = "44444444-4444-4444-4444-444444444444";

function fileReq(file?: File | string) {
  const form = new FormData();
  if (file !== undefined) form.set("file", file);
  return new Request("http://localhost/api/resume/extract", { method: "POST", body: form });
}
function pdf(bytes = [1, 2, 3], name = "resume.pdf") {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: "u@x.com" });
  mocks.isInvitedUser.mockResolvedValue(true);
  mocks.getProfile.mockResolvedValue({ resume_text: "x" });
  mocks.fileToResumeMarkdown.mockResolvedValue("# Ada\n\nExperience");
});

describe("POST /api/resume/extract — auth + budget gate", () => {
  test("401 anon — no invite/profile lookup, no token spend", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    const res = await POST(fileReq(pdf()));
    expect(res.status).toBe(401);
    expect(mocks.isInvitedUser).not.toHaveBeenCalled();
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.fileToResumeMarkdown).not.toHaveBeenCalled();
  });

  test("invited caller with no profile → allowed", async () => {
    mocks.isInvitedUser.mockResolvedValue(true);
    mocks.getProfile.mockResolvedValue(null);
    expect((await POST(fileReq(pdf()))).status).toBe(200);
  });

  test("not invited but has a profile → allowed", async () => {
    mocks.isInvitedUser.mockResolvedValue(false);
    mocks.getProfile.mockResolvedValue({ resume_text: "x" });
    expect((await POST(fileReq(pdf()))).status).toBe(200);
  });

  test("not invited AND no profile → 403, converter never called (no token spend)", async () => {
    mocks.isInvitedUser.mockResolvedValue(false);
    mocks.getProfile.mockResolvedValue(null);
    const res = await POST(fileReq(pdf()));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("isn't set up yet");
    expect(mocks.fileToResumeMarkdown).not.toHaveBeenCalled();
  });

  test("null email → isInvitedUser is skipped and the profile check decides", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: null });
    mocks.getProfile.mockResolvedValue(null);
    const res = await POST(fileReq(pdf()));
    expect(res.status).toBe(403);
    expect(mocks.isInvitedUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/resume/extract — multipart validation", () => {
  test("400 when the body is not form data", async () => {
    const res = await POST(new Request("http://localhost/api/resume/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: true }),
    }));
    expect(res.status).toBe(400);
  });

  test("400 when the 'file' field is missing", async () => {
    expect((await POST(fileReq())).status).toBe(400);
  });

  test("400 when 'file' is a string, not a File", async () => {
    expect((await POST(fileReq("just a string"))).status).toBe(400);
  });

  test("400 for a zero-byte file", async () => {
    expect((await POST(fileReq(pdf([])))).status).toBe(400);
  });

  test("422 when the converter cannot read the file", async () => {
    mocks.fileToResumeMarkdown.mockResolvedValue("");
    const res = await POST(fileReq(pdf()));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/resume/extract — happy path", () => {
  test("200 {markdown} equals the converter output; converter gets the exact bytes as pdf", async () => {
    mocks.fileToResumeMarkdown.mockResolvedValue("# Résumé\n\nbody");
    const res = await POST(fileReq(pdf([9, 8, 7])));
    expect(res.status).toBe(200);
    expect((await res.json()).markdown).toBe("# Résumé\n\nbody");
    const [bytes, kind] = mocks.fileToResumeMarkdown.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes as Uint8Array)).toEqual([9, 8, 7]);
    expect(kind).toBe("pdf");
  });
});
