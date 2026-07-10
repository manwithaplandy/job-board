import type { ProfileRow } from "@/lib/types";

export interface ReadinessCard {
  status: "Ready" | "Needs attention" | "Optional";
  summary: string;
}

export interface ProfileReadiness {
  readyCount: number;
  totalCore: 3;
  overall: "Ready to find matching jobs" | "Finish setting up your profile";
  jobPreferences: ReadinessCard;
  resume: ReadinessCard;
  applicationDetails: ReadinessCard;
  personalization: ReadinessCard;
}

const hasText = (value: string | null): boolean => Boolean(value?.trim());

export function formatProfileDate(value: string): string {
  return value.slice(0, 10);
}

export function deriveProfileReadiness(profile: ProfileRow): ProfileReadiness {
  const locationCount = profile.preferred_locations.length;
  const preferencesReady = locationCount > 0;
  const resumeReady = hasText(profile.resume_text);
  const missingEssentials = Number(!hasText(profile.full_name)) + Number(!hasText(profile.email));
  const applicationDetailsReady = missingEssentials === 0;
  const hasPersonalization = hasText(profile.resume_generation_instructions)
    || hasText(profile.cover_letter_generation_instructions);

  return {
    readyCount: Number(preferencesReady) + Number(resumeReady) + Number(applicationDetailsReady),
    totalCore: 3,
    overall: preferencesReady && resumeReady
      ? "Ready to find matching jobs"
      : "Finish setting up your profile",
    jobPreferences: {
      status: preferencesReady ? "Ready" : "Needs attention",
      summary: `${locationCount} ${locationCount === 1 ? "location" : "locations"}${profile.instructions ? " · Matching guidance added" : ""}`,
    },
    resume: {
      status: resumeReady ? "Ready" : "Needs attention",
      summary: resumeReady
        ? `Résumé updated ${formatProfileDate(profile.updated_at)}`
        : "Add a résumé to improve matching",
    },
    applicationDetails: {
      status: applicationDetailsReady ? "Ready" : "Needs attention",
      summary: missingEssentials === 0
        ? "Name and email ready"
        : `${missingEssentials} essential ${missingEssentials === 1 ? "answer" : "answers"} missing`,
    },
    personalization: {
      status: "Optional",
      summary: hasPersonalization ? "Writing preferences added" : "Use Rolefit defaults",
    },
  };
}
