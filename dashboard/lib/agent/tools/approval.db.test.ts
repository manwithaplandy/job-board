// The approval tools' writes against real Postgres and RLS (plan Task 1.16). The approval
// stop itself is the SDK's (approval.test.ts, loop.test.ts); these run the executes the
// way an approved call does. Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedProfile, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { proposeProfileDetailsTool, setResumeTool } from "@/lib/agent/tools/approval";
import { listResumeVersions } from "@/lib/workspaces/resumeVersions";

const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";
const DOC_OK = "44444444-4444-4444-8444-444444444444";
const DOC_FAILED = "55555555-5555-4555-8555-555555555555";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

const ctx = (extra: Partial<ToolCtx> = {}): ToolCtx => ({
  userId: USER_A, email: null, threadId: THREAD, runId: RUN, variant: 1, unattended: false,
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 }, ...extra,
});

async function seedDoc(id: string, extraction: "ok" | "failed", text: string | null) {
  await db.sql`INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extracted_text, extraction)
               VALUES (${id}, ${USER_A}, 'other', 'cv.pdf', 'application/pdf', 10, ${`${USER_A}/doc-${id}-cv.pdf`}, ${text}, ${extraction})`;
}

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM resume_versions`;
  await db.sql`DELETE FROM documents`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await seedProfile(db.sql, USER_A, {
    resume_text: "Old résumé",
    eeo_gender: "Prefer not to say",
    links: db.sql.json({ linkedin: "https://linkedin.example/in/pat" }),
    screening_answers: db.sql.json({ relocation: "No" }),
  });
  await seedDoc(DOC_OK, "ok", "New résumé from the upload");
  await seedDoc(DOC_FAILED, "failed", null);
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const resumeText = async () => (await db.sql`SELECT resume_text FROM profiles WHERE user_id = ${USER_A}`)[0].resume_text;

test("set_resume refuses a document whose extraction is not ok", async () => {
  expect(await setResumeTool(ctx(), { documentId: DOC_FAILED })).toEqual({ status: "refused", reason: "unusable_document" });
  expect(await resumeText()).toBe("Old résumé");
  expect(await db.sql`SELECT id FROM agent_actions`).toHaveLength(0);
  expect(await listResumeVersions(USER_A)).toEqual([]);
});

test("set_resume keeps the displaced text as a version and undo restores it", async () => {
  const out = await setResumeTool(ctx(), { documentId: DOC_OK });
  if (out.status !== "done" || out.actionId === null) throw new Error("expected an audited set_resume");
  expect(out.displacedVersion).toBe(1);
  expect(await resumeText()).toBe("New résumé from the upload");
  expect((await listResumeVersions(USER_A))[0]).toMatchObject({ version: 1, source: "agent", text: "Old résumé" });
  const [row] = await db.sql`SELECT actor, kind, before FROM agent_actions WHERE id = ${out.actionId}`;
  expect(row).toEqual({ actor: "agent", kind: "profile.set_resume", before: { version: 1 } });

  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await resumeText()).toBe("Old résumé");
  // The agent's text is itself kept as a version.
  expect((await listResumeVersions(USER_A))[0]).toMatchObject({ version: 2, source: "restore", text: "New résumé from the upload" });
});

test("undo of set_resume refuses with changed_since after the user edited the résumé", async () => {
  const out = await setResumeTool(ctx(), { documentId: DOC_OK });
  if (out.status !== "done" || out.actionId === null) throw new Error("expected an audited set_resume");
  await db.sql`UPDATE profiles SET resume_text = 'Edited by hand' WHERE user_id = ${USER_A}`;
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect(await resumeText()).toBe("Edited by hand");
});

test("propose_profile_details writes only the listed answers, merges links and screening answers, and leaves EEO answers alone", async () => {
  const out = await proposeProfileDetailsTool(ctx(), {
    fields: { phone: "+1 555 0100", work_authorized: true, links: { github: "https://github.example/pat" } },
    screeningAnswers: { notice_period: "2 weeks" },
  });
  expect(out).toEqual({ status: "done", fields: ["phone", "work_authorized", "links"], screeningAnswers: 1 });
  const [p] = await db.sql`SELECT full_name, phone, work_authorized, needs_sponsorship, links, screening_answers, eeo_gender
                           FROM profiles WHERE user_id = ${USER_A}`;
  expect(p).toEqual({
    full_name: null,
    phone: "+1 555 0100",
    work_authorized: true,
    needs_sponsorship: null,
    links: { linkedin: "https://linkedin.example/in/pat", github: "https://github.example/pat" },
    screening_answers: { relocation: "No", notice_period: "2 weeks" },
    eeo_gender: "Prefer not to say",
  });
  // Another user's row is out of reach (RLS), and a user with no profile gets a refusal.
  expect(await proposeProfileDetailsTool(ctx({ userId: USER_B }), { fields: { phone: "1" } })).toEqual({
    status: "refused", reason: "no_profile",
  });
});

test("propose_profile_details keeps the keys of links and screening answers stored as a legacy jsonb string", async () => {
  // A double-encoded write left both columns as jsonb string scalars holding JSON text.
  await db.sql`UPDATE profiles SET
    links = ${JSON.stringify(JSON.stringify({ linkedin: "https://linkedin.example/in/pat" }))}::text::jsonb,
    screening_answers = ${JSON.stringify(JSON.stringify({ relocation: "No" }))}::text::jsonb
    WHERE user_id = ${USER_A}`;
  const [seeded] = await db.sql`SELECT jsonb_typeof(links) AS l, jsonb_typeof(screening_answers) AS s FROM profiles WHERE user_id = ${USER_A}`;
  expect(seeded).toEqual({ l: "string", s: "string" });

  const out = await proposeProfileDetailsTool(ctx(), {
    fields: { links: { github: "https://github.example/pat" } },
    screeningAnswers: { notice_period: "2 weeks" },
  });
  expect(out).toEqual({ status: "done", fields: ["links"], screeningAnswers: 1 });
  const [p] = await db.sql`SELECT links, screening_answers, jsonb_typeof(links) AS l, jsonb_typeof(screening_answers) AS s
                           FROM profiles WHERE user_id = ${USER_A}`;
  expect(p).toEqual({
    links: { linkedin: "https://linkedin.example/in/pat", github: "https://github.example/pat" },
    screening_answers: { relocation: "No", notice_period: "2 weeks" },
    l: "object",
    s: "object",
  });
});
