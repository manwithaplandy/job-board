import type { ReactNode } from "react";

/** The one sentence an empty conversation shows (plan Task 1.20). */
export const EMPTY_SENTENCE = {
  profile: "Ask about your reviewed jobs, your shortlist or your applications.",
  noProfile: "Attach your résumé or tell me what kind of role you want.",
} as const;

/**
 * An empty conversation: exactly one sentence, then the composer with its upload
 * target. With no profile yet, the sentence points at the résumé first.
 */
export function EmptyState({ hasProfile, composer }: { hasProfile: boolean; composer: ReactNode }) {
  return (
    <div className="rf-agent-empty">
      <p className="rf-agent-empty__sentence">{hasProfile ? EMPTY_SENTENCE.profile : EMPTY_SENTENCE.noProfile}</p>
      {composer}
    </div>
  );
}
