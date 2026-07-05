# Backup & restore runbook

**Scope:** production Supabase project `fdhspmavadgucktetzoi` (job-board).
**Owner:** operator (single-tenant ops today).
**Last verified:** 2026-07-04.

This is the go-public "backup basics" deliverable (spec subsystem G). It records the
*verified* backup posture, a copy-pasteable restore procedure, what is and isn't
recoverable, and the RPO/RTO the current setup provides.

---

## 1. Verified backup entitlement

Checked 2026-07-04 via the Supabase management API:

| Fact | Value | Source |
|---|---|---|
| Project ref | `fdhspmavadgucktetzoi` (name `job-board`) | `get_project` |
| Region | `us-west-1` | `get_project` |
| Postgres | 17.6 (engine 17, GA channel) | `get_project` |
| Organization | `Malvani Inc` (`oyutqtrabcqzuugacuoc`) | `get_organization` |
| **Plan** | **Pro** | `get_organization` |

**What the Pro plan gives us (Supabase Pro entitlement):**

- **Daily physical backups, 7-day retention**, taken automatically. This is included in
  Pro and requires no configuration.
- **Point-in-Time Recovery (PITR) is an ADD-ON, not included by default.** As of the
  check above there is no evidence PITR is enabled. **Action before public launch:**
  confirm in the Supabase dashboard (Database → Backups) whether PITR is on. If it is
  not, decide whether to enable it (see §5) — daily-only backups mean up to ~24h of data
  loss on a restore.

> The management API surfaced here does not expose the backup *type/retention* fields
> directly, so the daily-vs-PITR distinction MUST be re-confirmed in the dashboard before
> trusting the RPO in §4. The plan tier (Pro) is verified; the backup schedule under it
> is per the Supabase Pro spec.

---

## 2. Restore procedure

### 2a. Initiate the restore

1. Supabase dashboard → project `job-board` → **Database → Backups**.
2. Choose a restore point:
   - **Daily backup:** pick the most recent daily snapshot before the incident.
   - **PITR (if enabled):** pick the exact timestamp (down to the second) just before the
     incident.
3. Confirm. Supabase restores in place (the project is unavailable during the restore).
   For a restore into a *fresh* project instead, download the backup and `pg_restore`
   into a new project, then repoint `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_*`.

### 2b. Post-restore checklist (run every time)

1. **Schema-migration audit.** Compare `schema_migrations` against `migrations/`:
   ```sql
   SELECT filename FROM schema_migrations ORDER BY filename;
   ```
   ```bash
   ls migrations/
   ```
   If the restore predates a migration, re-apply the missing files **in filename order**
   (they are all idempotent + recorded in `schema_migrations` on apply). `schema.sql`
   mirrors the full current schema and can rebuild a scratch DB from zero if needed.
2. **Re-sync subscriptions from Stripe (source of truth).** The `subscriptions` table is
   only a *mirror*; a restore can leave it stale. Reconcile by either:
   - replaying recent Stripe webhook events (Stripe dashboard → Developers → Webhooks →
     Resend), which the `/api/stripe/webhook` handler upserts idempotently, or
   - triggering the customer portal / a Checkout for affected users to re-emit
     `customer.subscription.*` events.
   Until reconciled, a user's plan reflects the backup's state, not Stripe's.
3. **Invalidate stuck review requests.** Any `review_requests` row left `running` by the
   restore will wedge that user's single active slot until the worker's stale-claim
   recovery (30 min) fires. To clear immediately:
   ```sql
   UPDATE review_requests SET status = 'failed', finished_at = now(),
          notes = 'invalidated after DB restore'
   WHERE status = 'running';
   ```
4. **Restart the reviewer worker** (Railway `reviewer-worker` service) so it reconnects
   to the restored DB and resumes the queue cleanly.
5. **Spot-check tenancy + counts.** Confirm RLS policies are present (they are in
   `schema.sql`, so a restore keeps them) and that `usage_counters` / `job_reviews` row
   counts look sane for a couple of known users.

---

## 3. What is NOT restorable

A DB restore recovers **only the Postgres database**. The following are outside the
snapshot and are lost / unaffected:

- **Storage objects (résumé files) deleted since the snapshot.** The `resumes` bucket is
  **not versioned** — a deleted object is gone permanently and a DB restore does not bring
  it back. (This is the same finality the T3 deletion and T5/privacy copy already state.)
  Conversely, objects *added* after the snapshot are NOT removed by a DB restore, so the
  DB may reference files that no longer exist, or orphan files no row references.
- **LangFuse traces** (LLM observability, US cloud) — third-party, governed by LangFuse
  retention, not restorable from our backup.
- **Data already sent to OpenRouter / downstream model providers** — third-party.
- **Stripe state** — Stripe is the payment source of truth; our mirror is rebuilt from it
  (§2b step 2), not from the backup.

---

## 4. RPO / RTO (what the current setup actually provides)

- **RPO (max data loss):** up to **~24 hours** with daily-only backups (worst case: an
  incident just before the next daily snapshot). **~minutes if PITR is enabled** (confirm
  per §1).
- **RTO (time to recover):** on the order of **tens of minutes** for a Supabase in-place
  restore of a database this size, plus the §2b checklist (Stripe re-sync + worker
  restart), realistically **under ~1 hour** end to end.

---

## 5. If daily-only (no PITR): enable-backups decision + interim dump

**Decision memo (fill in before public launch):**

- **Enable PITR add-on?** PITR on Supabase Pro is a paid add-on priced by retention
  window. For stranger-held résumé PII, a ~24h RPO is the main gap. Recommendation:
  enable PITR (7-day) before opening to paying strangers; the cost is small relative to
  the compliance/recovery value. *Owner to confirm price in the dashboard and decide.*

**Interim safety net (until PITR is on): a scheduled logical dump.** Runs nightly, keeps
a few days locally/off-site, and excludes nothing user-scoped:

```bash
# Full logical backup of the public schema (all user data included). Requires the direct
# connection string (not the pooler). Store OFF the Supabase project.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --file "job-board-$(date +%Y%m%d).dump"

# Restore into a scratch/replacement DB:
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$TARGET_DATABASE_URL" job-board-YYYYMMDD.dump
```

> Do NOT add `--schema`/`--table` filters that would drop user tables — the whole `public`
> schema must be captured. `schema.sql` can recreate structure; the dump carries the data.

---

## 6. Test-restore evidence

- [ ] **Pending:** perform one end-to-end test restore into a scratch project and record
  the date + observed RTO here **before public launch**. (No test restore has been
  performed yet as of 2026-07-04.)
