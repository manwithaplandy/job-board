// Pure validation for the onboarding submit. Kept separate from the server action
// (which does I/O) so the rules are unit-testable and shared with any client hint.

export interface OnboardingErrors {
  resume?: string;
  locations?: string;
  form?: string;
}

export interface OnboardingInput {
  // Server-side proof the account was invited (invite_redemptions). NOT user_metadata.
  invited: boolean;
  // An existing profiles row also authorizes onboarding (re-onboard / legacy users).
  hasProfile: boolean;
  resumeText: string;
  preferredLocations: string[];
}

// A mandatory location filter is the spec's #1 cost lever, not a UX nicety — so an
// empty selection is a hard rejection, same as an empty résumé.
export function validateOnboarding(input: OnboardingInput): OnboardingErrors {
  const errors: OnboardingErrors = {};
  // Invite gate first: a non-invited account with no existing profile can't spend
  // LLM budget, so don't even validate the fields for it.
  if (!input.invited && !input.hasProfile) {
    errors.form = "Your account hasn't been invited yet.";
    return errors;
  }
  if (!input.resumeText.trim()) {
    errors.resume = "Add your résumé — upload a PDF or paste the text.";
  }
  if (input.preferredLocations.length === 0) {
    errors.locations = "Pick at least one location to include — this is required.";
  }
  return errors;
}

export const hasErrors = (e: OnboardingErrors): boolean => Object.keys(e).length > 0;
