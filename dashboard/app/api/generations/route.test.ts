import { beforeEach, describe, expect, test, vi } from "vitest";

// GET /api/generations — the async-generation poll: authed-only, returns the
// viewer's pending + recently-settled generation_jobs rows for the toast provider.
const mocks = vi.hoisted(() => ({
  getUserClaims: vi.fn(),
  listGenerationActivity: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getUserClaims: mocks.getUserClaims }));
vi.mock("@/lib/generationJobs", () => ({ listGenerationActivity: mocks.listGenerationActivity }));

import { GET } from "@/app/api/generations/route";

const USER = "55555555-5555-5555-5555-555555555555";
const ROW = {
  id: "66666666-6666-6666-6666-666666666666",
  jobId: "ashby:acme:1",
  kind: "resume",
  status: "ready",
  error: null,
  jobTitle: "Engineer",
  company: "Acme",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:01:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserClaims.mockResolvedValue({ id: USER, email: "u@x.com" });
  mocks.listGenerationActivity.mockResolvedValue([ROW]);
});

describe("GET /api/generations", () => {
  test("401 anon — never touches the data layer", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.listGenerationActivity).not.toHaveBeenCalled();
  });

  test("returns the viewer's activity under { generations } (the codec's envelope)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ generations: [ROW] });
    expect(mocks.listGenerationActivity).toHaveBeenCalledWith(USER);
  });
});
