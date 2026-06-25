import { createHash } from "node:crypto";

// MUST match reviewer/profile.py: sha256((resume ?? "") + "\0" + (instructions ?? "")).
export function profileVersion(
  resumeText: string | null,
  instructions: string | null,
): string {
  const payload = `${resumeText ?? ""}\0${instructions ?? ""}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
