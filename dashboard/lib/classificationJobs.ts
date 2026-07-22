import { serviceSql } from "@/lib/db";
import { parseClassificationJob, type ClassificationJobRow } from "@/lib/classificationJobCodec";

// SERVICE-ROLE JUSTIFICATION (this file is on the serviceRoleAllowlist): the
// classification_jobs queue is service/admin-only — RLS is deny-all with NO
// authenticated grant by design (Task 1 migration). There is no per-tenant context
// to drop into: these reads are the operator-global admin console. Both callers are
// isAdmin-gated (app/api/admin/classification-jobs/route.ts and the /admin/
// classification page); this file must NEVER be imported from a tenant-reachable
// path. company_overrides / profiles.company_exclusions are the per-USER surfaces
// and go through withUserSql elsewhere — classification_jobs never does.
//
// The row codec (ClassificationJobRow + parseClassificationJob) lives in the PURE
// lib/classificationJobCodec.ts so the client poll panel can total-parse the response
// without importing serviceSql. It's re-exported here for the server data-layer's
// callers (and to keep the plan's Interfaces block intact).
export {
  parseClassificationJob,
  type ClassificationJobRow,
  type ClassificationJobStatus,
  type ClassificationSelectionMode,
} from "@/lib/classificationJobCodec";

// INT arrives as a JS number; BIGINT/NUMERIC arrive as a string from postgres.js.
// Returns null for anything non-finite; used only for the countTargets aggregate below.
const asNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Newest classification jobs first, for the admin console + poll route. */
export async function listClassificationJobs(limit = 20): Promise<ClassificationJobRow[]> {
  const rows = (await serviceSql`
    SELECT * FROM classification_jobs ORDER BY created_at DESC LIMIT ${limit}
  `) as unknown as unknown[];
  return rows
    .map(parseClassificationJob)
    .filter((j): j is ClassificationJobRow => j !== null);
}

/**
 * How many companies each selection mode would target right now — drives the admin
 * launcher's live counts and the ROM estimate's realistic ceiling.
 *
 * PARITY (load-bearing): the two FILTER predicates below MUST stay verbatim-equivalent
 * to company_discovery/jobs_db.py::_TARGET_MODES (the worker's target selection). If
 * they drift, the admin estimate and the actual run diverge. Parity is enforced by
 * convention + reviewer check, not code — change both sides together.
 */
export async function countTargets(): Promise<{ unclassified: number; unknownRepass: number }> {
  const rows = (await serviceSql`
    SELECT
      count(*) FILTER (WHERE c.classified_at IS NULL) AS unclassified,
      count(*) FILTER (
        WHERE c.classified_at IS NOT NULL AND (
          COALESCE(c.size, 'unknown') = 'unknown'
          OR COALESCE(c.hq_country, 'unknown') = 'unknown'
          OR COALESCE(c.industry, 'unknown') = 'unknown'
          OR c.classification_confidence = 'low'
        )
      ) AS unknown_repass
    FROM companies c
  `) as unknown as { unclassified: unknown; unknown_repass: unknown }[];
  const row = rows[0];
  return {
    unclassified: asNum(row?.unclassified) ?? 0,
    unknownRepass: asNum(row?.unknown_repass) ?? 0,
  };
}
