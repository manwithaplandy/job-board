import type { ApplicationAnswers, ProfileRow } from "@/lib/types";

// Project a saved profile row down to the reusable application answers surfaced on
// the board and snapshotted into a prepared package. Shared by the page loader and
// the "Prepare application" route so the two never drift.
export function applicationAnswersFromProfile(profile: ProfileRow): ApplicationAnswers {
  return {
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    links: profile.links,
    work_authorized: profile.work_authorized,
    needs_sponsorship: profile.needs_sponsorship,
    eeo_gender: profile.eeo_gender,
    eeo_race: profile.eeo_race,
    eeo_veteran: profile.eeo_veteran,
    eeo_disability: profile.eeo_disability,
    screening_answers: profile.screening_answers,
  };
}
