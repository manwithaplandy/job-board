import type { ProfileRow } from "@/lib/types";

// resume_text is the single source of truth for generation. The uploaded file is
// archival only (converted to markdown at upload time), so generation never
// downloads or re-parses it. Callers must have confirmed profile.resume_text.
export function getResumeSource(profile: Pick<ProfileRow, "resume_text">): { resumeText: string } {
  return { resumeText: profile.resume_text ?? "" };
}
