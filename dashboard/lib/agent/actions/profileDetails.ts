// The input of the propose_profile_details tool (plan Task 1.16), shared with its fixed
// confirm card (confirm.ts). Strict at every level, so an eeo_* key, or any key not
// listed here, fails validation: EEO answers are never written by the agent.
import { z } from "zod";

export const PROFILE_DETAIL_LABELS = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  links: "Links",
  work_authorized: "Work authorization",
  needs_sponsorship: "Visa sponsorship",
} as const;
export type ProfileDetailField = keyof typeof PROFILE_DETAIL_LABELS;

export const SCREENING_ANSWER_MAX = 500;
const SCREENING_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const short = (max: number) => z.string().trim().min(1).max(max);
const url = z.string().trim().min(1).max(300).regex(/^https?:\/\/\S+$/i);

export const ProfileDetailsInputSchema = z
  .object({
    fields: z
      .object({
        full_name: short(120).optional(),
        email: z.string().trim().email().max(200).optional(),
        phone: short(40).optional(),
        location: short(120).optional(),
        links: z.object({ linkedin: url.optional(), github: url.optional(), portfolio: url.optional() }).strict().optional(),
        work_authorized: z.boolean().optional(),
        needs_sponsorship: z.boolean().optional(),
      })
      .strict(),
    screeningAnswers: z
      .record(z.string().regex(SCREENING_KEY_RE).refine((k) => !k.startsWith("eeo"), { message: "no EEO answers" }), short(SCREENING_ANSWER_MAX))
      .refine((r) => Object.keys(r).length <= 20, { message: "at most 20 answers" })
      .optional(),
  })
  .strict()
  .refine((i) => Object.keys(i.fields).length > 0 || Object.keys(i.screeningAnswers ?? {}).length > 0, {
    message: "nothing to save",
  });
export type ProfileDetailsInput = z.infer<typeof ProfileDetailsInputSchema>;
