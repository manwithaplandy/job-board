import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// notFound() throws in Next; make the mock throw a sentinel we can assert on.
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
  // The page imports the launcher/panel, which import useRouter from this module.
  // Never CALLED here (the gate test never renders the JSX tree), but the mocked
  // module must still define the export or vitest errors on access.
  useRouter: () => ({ refresh: () => {} }),
}));

// The launcher imports sonner's toast; the page pulls it into the module graph.
// Stub it so the node-env gate suite never touches the real toast runtime.
vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

// classification_jobs reads are service-role; stub them so the "admin proceeds"
// case stays a pure unit (no real serviceSql connect).
const jobs = vi.hoisted(() => ({
  listClassificationJobs: vi.fn(async () => []),
  countTargets: vi.fn(async () => ({ unclassified: 0, unknownRepass: 0 })),
}));
vi.mock("@/lib/classificationJobs", () => jobs);

const openrouter = vi.hoisted(() => ({ getStructuredModels: vi.fn(async () => []) }));
vi.mock("@/lib/openrouter", () => openrouter);

const OLD = process.env.ADMIN_EMAILS;
const { default: AdminClassificationPage } = await import("@/app/admin/classification/page");

beforeEach(() => {
  auth.getUserClaims.mockReset();
  jobs.listClassificationJobs.mockClear();
  jobs.countTargets.mockClear();
  openrouter.getStructuredModels.mockClear();
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
  vi.restoreAllMocks();
});

describe("AdminClassificationPage gate", () => {
  test("an authed NON-admin gets notFound() BEFORE any data fetch", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
    await expect(AdminClassificationPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(jobs.listClassificationJobs).not.toHaveBeenCalled();
    expect(jobs.countTargets).not.toHaveBeenCalled();
  });

  test("fails closed: with ADMIN_EMAILS unset even a plausible email is notFound", async () => {
    delete process.env.ADMIN_EMAILS;
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await expect(AdminClassificationPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(jobs.listClassificationJobs).not.toHaveBeenCalled();
  });

  test("anon (null claims) is notFound, never a data response", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue(null);
    await expect(AdminClassificationPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(jobs.listClassificationJobs).not.toHaveBeenCalled();
  });

  test("an admin proceeds to fetch jobs, target counts, and the model catalog", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await AdminClassificationPage();
    expect(jobs.listClassificationJobs).toHaveBeenCalledOnce();
    expect(jobs.countTargets).toHaveBeenCalledOnce();
    expect(openrouter.getStructuredModels).toHaveBeenCalledOnce();
  });
});
