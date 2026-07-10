import type { TransactionSql } from "postgres";
import { withUserSql } from "@/lib/db";
import { isAccountDeleted } from "@/lib/tombstone";
import { profileVersion } from "@/lib/profileVersion";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import type { ApplicationAnswers } from "@/lib/types";

export interface ResumeSourceInput {
  resumeText: string | null;
  resumeFilePath: string | null;
}
export interface DiscoveryPreferencesInput {
  preferredLocations: string[];
  companyInstructions: string | null;
}
export interface JobPreferencesInput extends DiscoveryPreferencesInput {
  instructions: string | null;
}
export interface GenerationDefaultsInput {
  resumeGenerationInstructions: string | null;
  coverLetterGenerationInstructions: string | null;
}
export interface ModelPreferencesInput {
  modelStage2: string | null;
  modelResume: string | null;
  modelCompany: string | null;
  modelCover: string | null;
  reasoningEffortResume: string | null;
  reasoningEffortCover: string | null;
}

export async function updateResumeSourceWith(
  tx: TransactionSql, userId: string, input: ResumeSourceInput,
): Promise<void> {
  const rows = await tx`SELECT instructions FROM profiles
    WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const instructions = (rows[0] as { instructions: string | null } | undefined)?.instructions ?? null;
  await tx`UPDATE profiles SET
    resume_text = ${input.resumeText},
    resume_file_path = ${input.resumeFilePath},
    profile_version = ${profileVersion(input.resumeText, instructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateReviewPreferencesWith(
  tx: TransactionSql, userId: string, instructions: string | null,
): Promise<void> {
  const rows = await tx`SELECT resume_text FROM profiles
    WHERE user_id = ${userId}::uuid FOR UPDATE`;
  const resumeText = (rows[0] as { resume_text: string | null } | undefined)?.resume_text ?? null;
  await tx`UPDATE profiles SET
    instructions = ${instructions},
    profile_version = ${profileVersion(resumeText, instructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateDiscoveryPreferencesWith(
  tx: TransactionSql, userId: string, input: DiscoveryPreferencesInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    preferred_locations = ${input.preferredLocations},
    company_instructions = ${input.companyInstructions},
    company_profile_version = ${companyProfileVersion(input.companyInstructions)},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateApplicationDetailsWith(
  tx: TransactionSql, userId: string, input: ApplicationAnswers,
): Promise<void> {
  await tx`UPDATE profiles SET
    full_name = ${input.full_name}, email = ${input.email}, phone = ${input.phone},
    location = ${input.location}, links = ${JSON.stringify(input.links)}::jsonb,
    work_authorized = ${input.work_authorized}, needs_sponsorship = ${input.needs_sponsorship},
    eeo_gender = ${input.eeo_gender}, eeo_race = ${input.eeo_race},
    eeo_veteran = ${input.eeo_veteran}, eeo_disability = ${input.eeo_disability},
    screening_answers = ${JSON.stringify(input.screening_answers)}::jsonb,
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateGenerationDefaultsWith(
  tx: TransactionSql, userId: string, input: GenerationDefaultsInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    resume_generation_instructions = ${input.resumeGenerationInstructions},
    cover_letter_generation_instructions = ${input.coverLetterGenerationInstructions},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

export async function updateModelPreferencesWith(
  tx: TransactionSql, userId: string, input: ModelPreferencesInput,
): Promise<void> {
  await tx`UPDATE profiles SET
    model_stage1 = NULL, model_stage2 = ${input.modelStage2},
    model_resume = ${input.modelResume}, model_company = ${input.modelCompany},
    model_cover = ${input.modelCover},
    reasoning_effort_resume = ${input.reasoningEffortResume},
    reasoning_effort_cover = ${input.reasoningEffortCover},
    updated_at = now()
    WHERE user_id = ${userId}::uuid`;
}

async function guarded(
  userId: string,
  write: (tx: TransactionSql) => Promise<void>,
): Promise<void> {
  if (await isAccountDeleted(userId)) return;
  await withUserSql(userId, write);
}

export const updateResumeSource = (u: string, d: ResumeSourceInput) =>
  guarded(u, (tx) => updateResumeSourceWith(tx, u, d));
export const updateReviewPreferences = (u: string, d: { instructions: string | null }) =>
  guarded(u, (tx) => updateReviewPreferencesWith(tx, u, d.instructions));
export const updateDiscoveryPreferences = (u: string, d: DiscoveryPreferencesInput) =>
  guarded(u, (tx) => updateDiscoveryPreferencesWith(tx, u, d));
export const updateJobPreferences = (u: string, d: JobPreferencesInput) =>
  guarded(u, async (tx) => {
    await updateReviewPreferencesWith(tx, u, d.instructions);
    await updateDiscoveryPreferencesWith(tx, u, d);
  });
export const updateApplicationDetails = (u: string, d: ApplicationAnswers) =>
  guarded(u, (tx) => updateApplicationDetailsWith(tx, u, d));
export const updateGenerationDefaults = (u: string, d: GenerationDefaultsInput) =>
  guarded(u, (tx) => updateGenerationDefaultsWith(tx, u, d));
export const updateModelPreferences = (u: string, d: ModelPreferencesInput) =>
  guarded(u, (tx) => updateModelPreferencesWith(tx, u, d));
