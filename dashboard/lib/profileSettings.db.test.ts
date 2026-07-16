import { afterAll, beforeAll, describe, expect, test } from "vitest";
import postgres from "postgres";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import {
  updateApplicationDetailsWith,
  updateDiscoveryPreferencesWith,
  updateResumeSourceWith,
  updateReviewPreferencesWith,
} from "@/lib/profileSettings";
import { profileVersion } from "@/lib/profileVersion";

const TEST_DSN = process.env.TEST_DATABASE_URL;
const USER_ID = "11111111-1111-1111-1111-111111111111";

describe.skipIf(!TEST_DSN)("profile settings writes -- real Postgres", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    sql = postgres(TEST_DSN as string, { prepare: false, max: 1, onnotice: () => {} });

    await sql`CREATE TEMP TABLE profiles (
      user_id UUID PRIMARY KEY,
      resume_text TEXT,
      resume_file_path TEXT,
      instructions TEXT,
      profile_version TEXT,
      preferred_locations TEXT[],
      company_instructions TEXT,
      company_profile_version TEXT,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      links JSONB,
      work_authorized BOOLEAN,
      needs_sponsorship BOOLEAN,
      eeo_gender TEXT,
      eeo_race TEXT,
      eeo_veteran TEXT,
      eeo_disability TEXT,
      screening_answers JSONB,
      resume_generation_instructions TEXT,
      cover_letter_generation_instructions TEXT,
      model_stage1 TEXT,
      model_stage2 TEXT,
      model_resume TEXT,
      model_company TEXT,
      model_cover TEXT,
      reasoning_effort_resume TEXT,
      reasoning_effort_cover TEXT,
      updated_at TIMESTAMPTZ
    )`;

    await sql`INSERT INTO profiles (
      user_id, resume_text, resume_file_path, instructions, profile_version,
      preferred_locations, company_instructions, company_profile_version,
      full_name, links, screening_answers, model_resume, updated_at
    ) VALUES (
      ${USER_ID}::uuid, 'old résumé', 'old.pdf', 'old instructions', 'old-version',
      ARRAY['Old location']::text[], 'old company instructions', 'old-company-version',
      'Old Name', '{}'::jsonb, '{}'::jsonb, 'keep-me', now()
    )`;
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  test("section updates preserve unrelated columns and recompute dependent versions", async () => {
    await sql.begin(async (tx) => {
      await updateApplicationDetailsWith(tx, USER_ID, {
        full_name: "Jane Doe",
        email: "jane@example.com",
        phone: "555-0100",
        location: "Phoenix, AZ",
        links: { linkedin: "https://www.linkedin.com/in/jane" },
        work_authorized: true,
        needs_sponsorship: false,
        eeo_gender: null,
        eeo_race: null,
        eeo_veteran: null,
        eeo_disability: null,
        screening_answers: {},
      });
      await updateDiscoveryPreferencesWith(tx, USER_ID, {
        preferredLocations: ["Remote"],
        companyInstructions: "avoid defense",
      });
      await updateReviewPreferencesWith(tx, USER_ID, "backend only");
      await updateResumeSourceWith(tx, USER_ID, {
        resumeText: "new résumé",
        resumeFilePath: "new.pdf",
      });
    });

    const rows = await sql<{
      preferred_locations: string[];
      full_name: string;
      resume_text: string;
      instructions: string;
      profile_version: string;
      company_profile_version: string;
      model_resume: string;
    }[]>`SELECT
      preferred_locations, full_name, resume_text, instructions, profile_version,
      company_profile_version, model_resume
      FROM profiles WHERE user_id = ${USER_ID}::uuid`;
    const row = rows[0];

    expect(row.preferred_locations).toEqual(["Remote"]);
    expect(row.full_name).toBe("Jane Doe");
    expect(row.resume_text).toBe("new résumé");
    expect(row.instructions).toBe("backend only");
    expect(row.profile_version).toBe(profileVersion("new résumé", "backend only"));
    expect(row.company_profile_version).toBe(companyProfileVersion("avoid defense"));
    expect(row.model_resume).toBe("keep-me");
  });
});
