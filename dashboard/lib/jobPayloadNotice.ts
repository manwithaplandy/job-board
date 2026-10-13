import {parseJobLifecycle,parseStringList,parseRequirements,unwrapLifecycleJson} from "@/lib/jobLifecycleState";
import type {JobReviewDetail} from "@/lib/types";
import { parseGreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

/** A hydration acknowledgement is distinct from a started generation. */
export function jobPayloadNotice(value:unknown):string|null {
  if(typeof value!=="object" || value===null || !("payload" in value)) return null;
  const payload=value.payload;
  if(typeof payload!=="object" || payload===null || !("status" in payload) ||
    (payload.status!=="pending" && payload.status!=="deferred")) return null;
  return "message" in value && typeof value.message==="string" && value.message.length<=300
    ? value.message : "Job details are being prepared. Try again shortly.";
}

/** Total parsing for the new current-versus-saved detail response fields. */
export function currentJobDetail(value: unknown) {
  const row = typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value)) : {};
  return {
    descriptionIsSaved: row.descriptionIsSaved === true,
    currentDescription: typeof row.currentDescription === "string" ? row.currentDescription : null,
    currentQuestions: parseGreenhouseQuestions(row.currentQuestions),
  };
}

/** Validate the actual HTTP detail boundary before merging it into a board row. */
export function parseJobDetailResponse(value: unknown): JobReviewDetail & {questions: ReturnType<typeof parseGreenhouseQuestions>} & ReturnType<typeof currentJobDetail> {
  const decoded=unwrapLifecycleJson(value);
  const row=decoded && typeof decoded === "object" && !Array.isArray(decoded) ? Object.fromEntries(Object.entries(decoded)) : {};
  const text=(raw:unknown) => typeof raw === "string" ? raw : null;
  return {...currentJobDetail(row),lifecycle:parseJobLifecycle(row.lifecycle),
    reasoning:text(row.reasoning),about:text(row.about),description:text(row.description),url:text(row.url),
    experience_match:text(row.experience_match),industry:text(row.industry),industry_subcategory:text(row.industry_subcategory),
    confidence:text(row.confidence),note:text(row.note),corrected:row.corrected === true,
    benefits:parseStringList(row.benefits),red_flags:parseStringList(row.red_flags),requirements:parseRequirements(row.requirements),
    questions:parseGreenhouseQuestions(unwrapLifecycleJson(row.questions))};
}
