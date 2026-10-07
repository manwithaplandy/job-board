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
