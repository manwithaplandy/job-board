import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUserId: vi.fn(async () => "9ae8b777-7c24-4290-8aad-bd2b10eff23b"),
  sql: vi.fn(async () => []),
  updateApplicationPackageResume: vi.fn(async () => undefined),
  updateApplicationPackageCover: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: mocks.requireUserId,
}));

vi.mock("@/lib/db", () => ({
  sql: mocks.sql,
}));

vi.mock("@/lib/queries", () => ({
  updateApplicationPackageResume: mocks.updateApplicationPackageResume,
  updateApplicationPackageCover: mocks.updateApplicationPackageCover,
}));

describe("application package server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not revalidate the board when persisting regenerated content", async () => {
    const { persistRegeneratedResume, persistRegeneratedCover } = await import(
      "@/app/actions/applications"
    );

    await persistRegeneratedResume("job-1", { headline: "Tailored" } as never);
    await persistRegeneratedCover("job-1", { greeting: "Hello" } as never);

    expect(mocks.updateApplicationPackageResume).toHaveBeenCalledWith(
      "9ae8b777-7c24-4290-8aad-bd2b10eff23b",
      "job-1",
      { headline: "Tailored" },
    );
    expect(mocks.updateApplicationPackageCover).toHaveBeenCalledWith(
      "9ae8b777-7c24-4290-8aad-bd2b10eff23b",
      "job-1",
      { greeting: "Hello" },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("still revalidates the board when changing applied state", async () => {
    const { markApplicationApplied } = await import("@/app/actions/applications");

    await markApplicationApplied("job-1");

    expect(mocks.sql).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });
});
