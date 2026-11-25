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
    company_overrides: [{ user_id: "user-a", company_id: 1, verdict: "exclude", company_name: "Acme" }],
    application_packages: [{ user_id: "user-a", id: 1 }],
    resume_scores: [],
    cover_letter_edits: [{ user_id: "user-a", job_id: "j1", edited_text: "edited" }],
    usage_counters: [{ user_id: "user-a", kind: "review", n: 3 }],
    subscriptions: [{ plan: "pro", status: "active" }],
    feedback: [{ user_id: "user-a", kind: "criticism", message: "Improve filters" }],
    matching_activity: [{ user_id: "user-a", last_meaningful_activity_at: "2026-10-02" }],
    review_requests: [],
    generation_jobs: [{ user_id: "user-a", job_id: "j1", kind: "resume", status: "ready" }],
    review_runs: [{ user_id: "user-a", id: 10 }],
    invite_redemptions: [{ user_id: "user-a", email: "a@x.com", code: "INV" }],
    agent_threads: [{ id: "t1", title: "A thread", variant: 1 }],
    agent_messages: [{ thread_id: "t1", id: "m1", role: "user", parts: [{ type: "text", text: "A asks" }] }],
    agent_runs: [{ id: "r1", thread_id: "t1", kind: "turn", status: "done", cost_micros: 1200 }],
    agent_settings: [{ default_variant: 2, background_enabled: true }],
  },
  "user-b": {
    profiles: [{ user_id: "user-b", resume_text: "B SECRET résumé" }],
    job_reviews: [{ user_id: "user-b", job_id: "jZ" }],
    review_corrections: [],
    company_reviews: [],
    company_overrides: [{ user_id: "user-b", company_id: 9, verdict: "exclude", company_name: "B OVERRIDE Co" }],
    application_packages: [],
    resume_scores: [],
    cover_letter_edits: [],
    usage_counters: [],
    subscriptions: [],
    review_requests: [],
    review_runs: [],
    invite_redemptions: [],
    agent_threads: [{ id: "tB", title: "B SECRET thread" }],
  },
  "empty-user": {
    profiles: [{ user_id: "empty-user", resume_text: null }],
    job_reviews: [], review_corrections: [], company_reviews: [], company_overrides: [],
    application_packages: [], resume_scores: [], cover_letter_edits: [], usage_counters: [],
    subscriptions: [], review_requests: [], review_runs: [], invite_redemptions: [],
  },
};

// Every SQL text the export ran, so tests can check exactly which columns it reads.
const ranSql: string[] = [];

function makeTx(userId: string) {
  const rows = DB[userId] ?? {};
  const pick = (sql: string): unknown[] => {
    ranSql.push(sql);
    if (/FROM job_payload_demands/.test(sql)) throw new Error("permission denied for table job_payload_demands");
    // An account read before the agent migration is applied: the tables do not exist yet.
    if (userId === "pre-agent-user" && /FROM agent_/.test(sql)) throw new Error('relation "agent_threads" does not exist');
    if (/FROM agent_threads/.test(sql)) return rows.agent_threads ?? [];
    if (/FROM agent_messages/.test(sql)) return rows.agent_messages ?? [];
    if (/FROM agent_runs/.test(sql)) return rows.agent_runs ?? [];
    if (/FROM agent_settings/.test(sql)) return rows.agent_settings ?? [];
    if (/FROM feedback/.test(sql)) return rows.feedback ?? [];
    if (/FROM matching_activity/.test(sql)) return rows.matching_activity ?? [];
    if (/FROM profiles/.test(sql)) return rows.profiles ?? [];
    if (/FROM job_reviews/.test(sql)) return rows.job_reviews ?? [];
    if (/FROM review_corrections/.test(sql)) return rows.review_corrections ?? [];
    if (/FROM company_reviews/.test(sql)) return rows.company_reviews ?? [];
    if (/FROM company_overrides/.test(sql)) return rows.company_overrides ?? [];
    if (/FROM application_packages/.test(sql)) return rows.application_packages ?? [];
    if (/FROM resume_scores/.test(sql)) return rows.resume_scores ?? [];
    if (/FROM cover_letter_edits/.test(sql)) return rows.cover_letter_edits ?? [];
    if (/FROM usage_counters/.test(sql)) return rows.usage_counters ?? [];
    if (/FROM subscriptions/.test(sql)) return rows.subscriptions ?? [];
    if (/FROM review_requests/.test(sql)) return rows.review_requests ?? [];
    if (/FROM generation_jobs/.test(sql)) return rows.generation_jobs ?? [];
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
vi.mock("@/lib/invites", () => ({ listInvitesCreatedBy: async () => [] }));
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
    // Exercise the company_overrides export path: the caller's own override row is
    // present, and another user's distinctive override marker is structurally absent.
    expect(out.company_overrides).toMatchObject([{ company_id: 1, verdict: "exclude" }]);
    expect(serialized).not.toContain("B OVERRIDE");
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

test("exports feedback and activity owned by the account", async () => {
  const result = await buildAccountExport("user-a", "a@x.com", noFiles);
  expect(result).toHaveProperty("feedback", DB["user-a"].feedback);
  expect(result).toHaveProperty("matching_activity", DB["user-a"].matching_activity);
});

test("reports inaccessible lifecycle demands without claiming a complete empty export", async () => {
  const result = await buildAccountExport("user-a", "a@x.com", noFiles);
  expect(result).toHaveProperty("job_payload_demands", null);
  expect(result).toHaveProperty("job_payload_demands_error", "lifecycle demand export unavailable");
  expect(JSON.stringify(result)).not.toContain("permission denied");
});

describe("agent tables", () => {
  const selected = (table: string) => {
    const text = ranSql.filter((q) => new RegExp(`FROM ${table}\\b`).test(q)).at(-1);
    if (!text) throw new Error(`no read of ${table}`);
    return text.replace(/\s+/g, " ").match(/SELECT (.*?) FROM/)![1].split(",").map((c) => c.trim());
  };

  test("exports the caller's agent threads, messages, runs and settings, and none of another user's", async () => {
    const out = await buildAccountExport("user-a", "a@x.com", noFiles);
    expect(out.agent_threads).toEqual(DB["user-a"].agent_threads);
    expect(out.agent_messages).toEqual(DB["user-a"].agent_messages);
    expect(out.agent_runs).toEqual(DB["user-a"].agent_runs);
    expect(out.agent_settings).toEqual(DB["user-a"].agent_settings[0]);
    expect(out.agent_tables_error).toBeNull();
    expect(JSON.stringify(out)).not.toContain("B SECRET thread");
  });

  test("reads only the named columns, never select-star", async () => {
    await buildAccountExport("user-a", "a@x.com", noFiles);
    expect(selected("agent_threads")).toEqual(["id", "title", "variant", "summary", "created_at", "updated_at", "archived_at"]);
    expect(selected("agent_messages")).toEqual(["thread_id", "id", "role", "parts", "status", "created_at"]);
    expect(selected("agent_runs")).toEqual([
      "id", "thread_id", "kind", "job", "status", "model", "variant", "steps", "input_tokens", "output_tokens",
      "cost_micros", "error", "scheduled_for", "started_at", "finished_at", "created_at",
    ]);
    expect(selected("agent_settings")).toEqual(["default_variant", "background_enabled", "updated_at"]);
  });

  test("an account with no agent data exports empty lists and a null settings row", async () => {
    const out = await buildAccountExport("empty-user", "e@x.com", noFiles);
    expect(out.agent_threads).toEqual([]);
    expect(out.agent_messages).toEqual([]);
    expect(out.agent_runs).toEqual([]);
    expect(out.agent_settings).toBeNull();
    expect(out.agent_tables_error).toBeNull();
  });

  test("before the agent tables exist, the rest of the export still succeeds and says agent data is unavailable", async () => {
    const out = await buildAccountExport("pre-agent-user", "p@x.com", noFiles);
    expect(out).toHaveProperty("profiles");
    expect(out.agent_threads).toBeNull();
    expect(out.agent_messages).toBeNull();
    expect(out.agent_runs).toBeNull();
    expect(out.agent_settings).toBeNull();
    expect(out.agent_tables_error).toBe("agent data export unavailable");
    expect(JSON.stringify(out)).not.toContain("does not exist");
  });
});
