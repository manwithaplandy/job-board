/** A hydration acknowledgement is distinct from a started generation. */
export function jobPayloadNotice(value:unknown):string|null {
  if(typeof value!=="object" || value===null || !("payload" in value)) return null;
  const payload=value.payload;
  if(typeof payload!=="object" || payload===null || !("status" in payload) ||
    (payload.status!=="pending" && payload.status!=="deferred")) return null;
  return "message" in value && typeof value.message==="string" && value.message.length<=300
    ? value.message : "Job details are being prepared. Try again shortly.";
}
