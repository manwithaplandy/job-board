// What a turn's tools have read so far (Task 0.10). Read tools write what they return
// into ctx.gathered; the deterministic fallback (D8) and surfaces bind to it. It never
// holds a job description, a document body or an EEO field.
import type {
  ApplicationRow,
  DocumentMeta,
  JobFacts,
  MemoDoc,
  MetricResult,
  ProfileSummary,
  ReviewFacts,
  ShortlistRow,
} from "@/lib/workspaces/types";

export interface GatheredData {
  profile: ProfileSummary | null;
  jobs: Record<string, JobFacts>;
  reviews: Record<string, ReviewFacts>;
  memo: MemoDoc | null;
  shortlist: ShortlistRow[];
  applications: ApplicationRow[];
  documents: DocumentMeta[];
  metrics: MetricResult[];
}

export function emptyGathered(): GatheredData {
  return {
    profile: null,
    jobs: {},
    reviews: {},
    memo: null,
    shortlist: [],
    applications: [],
    documents: [],
    metrics: [],
  };
}
