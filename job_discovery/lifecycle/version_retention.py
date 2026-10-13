"""Exact-proof local public-history compaction; never semantic edge removal."""
from .config import read_control

# At most 12 extra row effects/posting: 25*(8+12) <= 500.
REPLACEMENT_RETIRE_ROWS = 12
REFERENCES = ("jobs", "job_questions", "job_reviews", "review_corrections",
              "application_packages", "resume_scores", "cover_letter_edits",
              "generation_jobs", "job_payload_demands")
UNREFERENCED = " AND ".join(
    f"NOT EXISTS(SELECT FROM {table} WHERE {'description_version_id' if table == 'jobs' else 'job_version_id'}=v.id)"
    for table in REFERENCES
)
ELIGIBLE = f"""EXISTS(SELECT FROM public_archive_version_coverage c
 WHERE c.version_id=v.id AND c.source_listing_id=v.source_listing_id
 AND c.version_revision=v.revision AND c.content_hash=v.content_hash)
 AND NOT EXISTS(SELECT FROM public_pending_events WHERE aggregate_type='job_versions' AND aggregate_id=v.id::text)
 AND {UNREFERENCED}
 AND NOT EXISTS(SELECT FROM job_locations e WHERE e.job_version_id=v.id
   AND NOT lifecycle_private.edge_compaction_ready('job_locations',e.id,v.id))
 AND NOT EXISTS(SELECT FROM job_skills e WHERE e.job_version_id=v.id
   AND NOT lifecycle_private.edge_compaction_ready('job_skills',e.id,v.id))"""
COST = """1+(SELECT count(*) FROM job_locations WHERE job_version_id=v.id)
 +(SELECT count(*) FROM job_skills WHERE job_version_id=v.id)"""
BYTES = """octet_length(v.public_metadata::text)
 +COALESCE((SELECT sum(octet_length(to_jsonb(e)::text)) FROM job_locations e WHERE job_version_id=v.id),0)
 +COALESCE((SELECT sum(octet_length(to_jsonb(e)::text)) FROM job_skills e WHERE job_version_id=v.id),0)"""


def replacement_plan(conn, listing):
    rows = conn.execute(f"""SELECT v.id,v.revision,
      v.recorded_at<=clock_timestamp()-interval '30 days' AS old,
      ({ELIGIBLE}) AS eligible,({COST}) AS cost,({BYTES}) AS bytes
      FROM job_versions v WHERE source_listing_id=%s ORDER BY revision LIMIT 12""", (listing["id"],)).fetchall()
    if len(rows) > 11:
        return None  # Maintenance drains inherited oversized histories first.
    retire = [r for r in rows if r["old"]]
    for row in rows:
        if len(rows)-len(retire) < 11:
            break
        if row not in retire and row["eligible"]:
            retire.append(row)
    if not retire:
        return [] if len(rows)<11 else None
    ctl = read_control(conn)
    if (ctl.safety_stage != "enforced" or not ctl.retirement_enabled or ctl.retirement_dry_run
        or len(rows)-len(retire)>=11
        or any(not row["eligible"] for row in retire)
        or sum(row["cost"] for row in retire) > REPLACEMENT_RETIRE_ROWS
        or sum(row["bytes"] for row in retire) > 64*1024**2):
        return None
    return retire


def compact_versions(conn, ids):
    if not ids:
        return
    # Caller has already moved the current pointer (replacement), or selected
    # only superseded rows (maintenance), under the common gate + Job lock.
    conn.execute("DELETE FROM job_locations WHERE job_version_id=ANY(%s)", (ids,))
    conn.execute("DELETE FROM job_skills WHERE job_version_id=ANY(%s)", (ids,))
    conn.execute("DELETE FROM job_versions WHERE id=ANY(%s)", (ids,))
