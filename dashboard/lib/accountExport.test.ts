import { describe, expect, test, vi } from "vitest";
import {
  USER_DELETE_TABLES,
  USER_ANONYMIZE_TABLES,
} from "@/lib/userScopedTables";

// Per-user DB fixtures. makeTx below serves ONLY the requested userId's rows, so an
// export built for user A can structurally never contain user B's rows — the same
// guarantee RLS gives at the DB level, exercised here without a live Postgres.
const DB: Record<string, Record<string, unknown[]>> = {
  "user-a": {
    profiles: [{ user_id: "user-a", resume_text: "A résumé" }],
    job_reviews: [{ user_id: "user-a", job_id: "j1", job_title: "Eng" }],
    review_corrections: [],
    company_reviews: [{ user_id: "user-a", company_name: "Acme" }],
    application_packages: [{ user_id: "user-a", id: 1 }],
    resume_scores: [],
    usage_counters: [{ user_id: "user-a", kind: "review", n: 3 }],
    subscriptions: [{ plan: "pro", status: "active" }],
    review_requests: [],
    review_runs: [{ user_id: "user-a", id: 10 }],
    invite_redemptions: [{ user_id: "user-a", email: "a@x.com", code: "INV" }],
  },
  "user-b": {
    profiles: [{ user_id: "user-b", resume_text: "B SECRET résumé" }],
    job_reviews: [{ user_id: "user-b", job_id: "jZ" }],
    review_corrections: [],
    company_reviews: [],
    application_packages: [],
    resume_scores: [],
    usage_counters: [],
    subscriptions: [],
    review_requests: [],
    review_runs: [],
    invite_redemptions: [],
  },
  "empty-user": {
    profiles: [{ user_id: "empty-user", resume_text: null }],
    job_reviews: [], review_corrections: [], company_reviews: [],
    application_packages: [], resume_scores: [], usage_counters: [],
    subscriptions: [], review_requests: [], review_runs: [], invite_redemptions: [],
  },
};

function makeTx(userId: string) {
  const rows = DB[userId] ?? {};
  const pick = (sql: string): unknown[] => {
    if (/FROM profiles/.test(sql)) return rows.profiles ?? [];
    if (/FROM job_reviews/.test(sql)) return rows.job_reviews ?? [];
    if (/FROM review_corrections/.test(sql)) return rows.review_corrections ?? [];
    if (/FROM company_reviews/.test(sql)) return rows.company_reviews ?? [];
    if (/FROM application_packages/.test(sql)) return rows.application_packages ?? [];
    if (/FROM resume_scores/.test(sql)) return rows.resume_scores ?? [];
    if (/FROM usage_counters/.test(sql)) return rows.usage_counters ?? [];
    if (/FROM subscriptions/.test(sql)) return rows.subscriptions ?? [];
    if (/FROM review_requests/.test(sql)) return rows.review_requests ?? [];
    if (/FROM review_runs/.test(sql)) return rows.review_runs ?? [];
    if (/FROM invite_redemptions/.test(sql)) return rows.invite_redemptions ?? [];
    return [];
  };
  return (strings: TemplateStringsArray) => Promise.resolve(pick(strings.join(" ")));
}

vi.mock("@/lib/db", () => ({
  withUserSql: (userId: string, fn: (tx: unknown) => Promise<unknown>) => fn(makeTx(userId)),
}));

// Avoid pulling the real storage client; buildAccountExport takes an injected resolver
// in these tests, but the module still imports createClient at load.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// Imported AFTER the mocks are registered.
const { buildAccountExport } = await import("@/lib/accountExport");

const noFiles = async () => [];

describe("buildAccountExport", () => {
  test("includes a top-level key for every classified user-scoped table", async () => {
    const out = await buildAccountExport("user-a", "a@x.com", noFiles);
    for (const t of [...USER_DELETE_TABLES, ...USER_ANONYMIZE_TABLES]) {
      expect(out).toHaveProperty(t);
    }
    expect(out).toHaveProperty("resume_files");
    expect(out).toHaveProperty("exported_at");
    expect(out.user_id).toBe("user-a");
  });

  test("contains the caller's own rows and NONE of another user's", async () => {
    const out = await buildAccountExport("user-a", "a@x.com", noFiles);
    const serialized = JSON.stringify(out);
    expect(serialized).toContain("A résumé");
    expect(serialized).not.toContain("B SECRET");
    expect(serialized).not.toContain("jZ");
    expect(out.subscriptions).toMatchObject({ plan: "pro" });
  });

  test("an empty account (only a profiles row) exports successfully with empty arrays", async () => {
    const out = await buildAccountExport("empty-user", "e@x.com", noFiles);
    expect(out.profiles).toMatchObject({ user_id: "empty-user" });
    expect(out.job_reviews).toEqual([]);
    expect(out.invite_redemptions).toEqual([]);
    expect(out.resume_files).toEqual([]);
    expect(out.subscriptions).toBeNull();
  });

  test("résumé files come from the injected resolver; no error marker on success", async () => {
    const files = [{ path: "user-a/r.pdf", signedUrl: "https://signed/x" }];
    const out = await buildAccountExport("user-a", "a@x.com", async () => files);
    expect(out.resume_files).toEqual(files);
    expect(out.resume_files_error).toBeNull();
  });

  test("a storage failure is a GENERIC marker (raw error not leaked) — minor 7", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await buildAccountExport("user-a", "a@x.com", async () => {
      throw new Error("storage down: host=db.internal bucket=resumes");
    });
    // The rest of the export still succeeds…
    expect(out).toHaveProperty("profiles");
    expect(out.job_reviews.length).toBeGreaterThan(0);
    // …but the résumé-file failure is recorded as a fixed generic marker, not disguised
    // as an empty list AND not leaking the raw storage internals into the download.
    expect(out.resume_files).toEqual([]);
    expect(out.resume_files_error).toBe("résumé files could not be listed");
    expect(out.resume_files_error).not.toContain("host=");
    // The full error is still logged server-side for incident triage.
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
