"""Bounded, DB-only maintenance. Payload retirement defaults to a dry run.

Callers give sweep an otherwise idle connection: each batch commits progress.
The compact cursor/fences survive worker restart. No external capabilities are
imported here; reported logical bytes never reduce the physical capacity guard.
"""
import logging
from time import monotonic

from job_discovery import db
from .capacity import CEILING_BYTES
from .claims import claim_work, renew_claim, validate_claim, cancel_claim
from .config import read_control
from .locks import enter_gate, lock_jobs
from .types import ClaimRef, SweepResult

log = logging.getLogger(__name__)
BATCH_ROWS = 2000
MAX_ROWS = 20000
MAX_RETIRE_BYTES = 64 * 1024**2
DEADLINE_SECONDS = 90
LEASE_SECONDS = 120
RENEW_SECONDS = 30

_UNPROTECTED = """
NOT EXISTS(SELECT FROM job_reviews WHERE job_id=j.id AND verdict='approve')
AND NOT EXISTS(SELECT FROM review_corrections WHERE job_id=j.id)
AND NOT EXISTS(SELECT FROM application_packages WHERE job_id=j.id)
AND NOT EXISTS(SELECT FROM resume_scores WHERE job_id=j.id)
AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_id=j.id)
AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_id=j.id AND status IN ('pending','running'))
AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_id=j.id AND
 (status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp()
  OR protection_until>clock_timestamp()
  OR consumed_at IS NOT NULL AND (consumption_applied_at IS NULL OR consumption_applied_at<consumed_at)))
"""
_DESCRIPTION_DUE = """j.description IS NOT NULL AND
 COALESCE(j.description_last_used_at,j.description_captured_at)<=clock_timestamp()-interval '720 hours'"""
_QUESTIONS_DUE = """q.questions IS NOT NULL AND q.questions<>'null'::jsonb AND
 COALESCE(q.last_used_at,q.captured_at)<=clock_timestamp()-interval '168 hours'"""



class _PhaseEnded(Exception):
    """No more statements may start in this transaction's time window."""


class _TimedConnection:
    """Clip EVERY statement, including statements after enter_gate resets 5s.

    Keep five seconds for persisting/committing progress and another five for
    renewal/final health. A spent window rolls back only its unfinished batch.
    This is worker scheduling, independent of the DB-clock enforcement contract.
    """
    def __init__(self, conn, end, yield_at=None):
        self.conn, self.end = conn, end
        self.yield_at = end if yield_at is None else yield_at
        self.yielded = False

    def should_yield(self):
        self.yielded = monotonic() >= self.yield_at
        return self.yielded

    def _timeout(self):
        remaining_ms = int((self.end - monotonic()) * 1000)
        if remaining_ms <= 0:
            raise _PhaseEnded()
        self.conn.execute("SELECT set_config('statement_timeout',%s,true)",
                          (str(min(5000, remaining_ms)),))
        if monotonic() >= self.end:
            raise _PhaseEnded()

    def execute(self, query, params=None):
        self._timeout()
        return self.conn.execute(query, params)

    def cursor(self, **kwargs):
        owner = self
        class Cursor:
            def __enter__(self):
                self.real = owner.conn.cursor(**kwargs).__enter__()
                return self
            def __exit__(self, *args):
                return self.real.__exit__(*args)
            def execute(self, *args, **kw):
                owner._timeout()
                return self.real.execute(*args, **kw)
            def __getattr__(self, name):
                return getattr(self.real, name)
        return Cursor()

    def commit(self):
        self._timeout()
        self.conn.commit()

def legacy_prune_disabled(conn) -> bool:
    enter_gate(conn)
    return read_control(conn).maintenance_enabled or read_control(conn).safety_stage == 'enforced' or bool(
        conn.execute('SELECT cutover_at FROM lifecycle_maintenance_state WHERE singleton').fetchone()['cutover_at'])


def _lock_candidate_prefix(conn, job_ids):
    """Acquire a sorted prefix, reserving half the available work time for DML.

    All selected Job keys precede row/FK work. Unacquired keys stay eligible for
    a later committed chunk; callers must only process the returned prefix.
    """
    keys = sorted(set(job_ids))
    if not isinstance(conn, _TimedConnection):
        lock_jobs(conn, keys)
        return keys
    started = monotonic()
    acquire_until = started + max(0, conn.yield_at - started) / 2
    acquired = []
    for key in keys:
        if monotonic() >= acquire_until:
            if not acquired:
                conn.yielded = True
            break
        # Reuse the common gate/key protocol. Each singleton follows the same
        # sorted order, and no row or FK lock is acquired until this loop ends.
        lock_jobs(conn, [key])
        acquired.append(key)
    return acquired


def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
    # Scan IDs, including protected/NULL rows, so a permanent prefix cannot starve
    # later jobs. <=250 jobs keeps description/question mutations within 500.
    rows = conn.execute('SELECT id FROM jobs WHERE (%s::text IS NULL OR id COLLATE "C">%s COLLATE "C") ORDER BY id COLLATE "C" LIMIT %s',
                        (cursor, cursor, min(250, limit))).fetchall()
    if not rows:
        return 0, 0, 0, 0, None
    ids = _lock_candidate_prefix(conn, [r['id'] for r in rows])
    if not ids:
        return 0, 0, 0, 0, cursor
    conn.execute('SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id COLLATE "C" FOR UPDATE', (ids,)).fetchall()
    # Fresh statement snapshot after the gate and job locks, not candidate data.
    eligible = conn.execute(f'''SELECT j.id, ({_DESCRIPTION_DUE}) AS description_due,
      ({_QUESTIONS_DUE}) AS questions_due,
      CASE WHEN {_DESCRIPTION_DUE} THEN octet_length(j.description) ELSE 0 END AS description_bytes,
      CASE WHEN {_QUESTIONS_DUE} THEN octet_length(q.questions::text) ELSE 0 END AS question_bytes
      FROM jobs j LEFT JOIN job_questions q ON q.job_id=j.id
      WHERE j.id=ANY(%s) AND {_UNPROTECTED} ORDER BY j.id COLLATE "C"''', (ids,)).fetchall()
    retired = size = candidates = visited = 0
    completed_cursor = cursor
    eligible_by_id = {row['id']: row for row in eligible}
    for job_id in ids:
        if isinstance(conn, _TimedConnection) and conn.should_yield():
            break
        row = eligible_by_id.get(job_id)
        if row is None:
            visited += 1
            completed_cursor = job_id
            continue
        complete = True
        for field in ('description', 'questions'):
            if isinstance(conn, _TimedConnection) and conn.should_yield():
                complete = False
                break
            if not row[field + '_due']:
                continue
            candidates += 1
            row_bytes = row['description_bytes' if field == 'description' else 'question_bytes']
            if dry_run or retired >= limit or size + row_bytes > byte_limit:
                continue
            if field == 'description':
                conn.execute('UPDATE jobs SET description=NULL,description_pruned=true WHERE id=%s', (row['id'],))
                size += row['description_bytes']
            else:
                conn.execute('DELETE FROM job_questions WHERE job_id=%s', (row['id'],))
                size += row['question_bytes']
            retired += 1
        visited += 1
        if not complete:
            break  # Resume this Job; an already-cleared field is simply absent.
        completed_cursor = job_id
    return max(visited, retired), retired, size, candidates, completed_cursor


def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
    from .version_retention import ELIGIBLE, COST, BYTES, compact_versions
    rows = conn.execute(f'''SELECT v.id,v.job_id,({BYTES}) AS bytes,({COST}) AS cost
      FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
      WHERE v.id IS DISTINCT FROM s.current_version_id AND {ELIGIBLE}
      AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
        (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
         AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=9)
      ORDER BY v.recorded_at,v.id LIMIT %s''', (min(limit,100),)).fetchall()
    selected = []
    size = effects = 0
    for row in rows:
        if size+row['bytes']<=byte_limit and effects+row['cost']<=min(limit,400):
            selected.append(row)
            size += row['bytes']
            effects += row['cost']
    acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in selected]))
    selected = [r for r in selected if r['job_id'] in acquired]
    if not dry_run:
        compact_versions(conn,[r['id'] for r in selected])
    return sum(r['cost'] for r in selected), 0 if dry_run else len(selected), 0 if dry_run else sum(r['bytes'] for r in selected)


def _staging_batch(conn, limit):
    # Select just one enumeration: a huge member set is drained over bounded
    # commits. Its compact source/claim floors are advanced BEFORE any deletion.
    row = conn.execute('''SELECT e.*,p.reason FROM source_enumerations e
      LEFT JOIN lifecycle_staging_cleanup p ON p.enumeration_id=e.id
      WHERE p.enumeration_id IS NOT NULL OR
       (e.status='complete' AND e.reconciled_at<=clock_timestamp()-interval '24 hours'
        AND EXISTS(SELECT FROM reconciliation_checkpoints c WHERE c.enumeration_id=e.id
          AND c.completed_at<=clock_timestamp()-interval '24 hours'))
       OR (e.started_at<=clock_timestamp()-interval '168 hours' AND
           (e.reconciled_at IS NULL OR e.status<>'complete'))
      ORDER BY e.started_at,e.id LIMIT 1''').fetchone()
    if not row:
        return 0
    if row['reason'] is None:
        if limit < 3:
            return 0
        # Do not invalidate a newer enumeration's claim. An old sequence still
        # receives its replay floor even when the source has since been reclaimed.
        conn.execute('''UPDATE lifecycle_claims SET replay_floor=generation,generation=generation+1,
          state='cancelled',terminal_at=clock_timestamp() WHERE kind='source' AND work_id=%s
          AND generation=%s AND owner_token=%s''', (str(row['source_id']), row['generation'], row['owner_token']))
        conn.execute('UPDATE source_accounts SET replay_floor=GREATEST(replay_floor,%s) WHERE id=%s', (row['sequence'], row['source_id']))
        conn.execute('INSERT INTO lifecycle_staging_cleanup(enumeration_id,reason) VALUES(%s,%s)',
                     (row['id'], 'completed' if row['status'] == 'complete' and row['reconciled_at'] else 'abandoned'))
        return 3  # Claim, source floor, and cleanup checkpoint are durable.
    n = conn.execute('''UPDATE capacity_reservations SET state='fenced',terminal_at=clock_timestamp(),
      measured_database_bytes=pg_database_size(current_database()) WHERE id IN
      (SELECT r.id FROM capacity_reservations r JOIN lifecycle_claims c
       ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE c.kind='source' AND c.work_id=%s
       AND r.state='held' AND r.generation<c.generation AND r.generation<=c.replay_floor
       ORDER BY r.id LIMIT %s)''', (str(row['source_id']), limit)).rowcount
    if n:
        return n
    n = conn.execute('''DELETE FROM enumeration_members WHERE (enumeration_id,external_id) IN
      (SELECT enumeration_id,external_id FROM enumeration_members WHERE enumeration_id=%s ORDER BY external_id LIMIT %s)''', (row['id'], limit)).rowcount
    if n:
        return n
    # No cascading unbounded deletion: consume checkpoint/marker/parent one at a
    # time when the remaining run budget allows all three.
    if limit < 3:
        return 0
    n = conn.execute('DELETE FROM reconciliation_checkpoints WHERE enumeration_id=%s', (row['id'],)).rowcount
    n += conn.execute('DELETE FROM lifecycle_staging_cleanup WHERE enumeration_id=%s', (row['id'],)).rowcount
    n += conn.execute('DELETE FROM source_enumerations WHERE id=%s', (row['id'],)).rowcount
    return n


def finalize_completed_producers(conn, limit=100):
    """Complete only committed settled producer work, retaining compact floors.

    Public-writer identities are transaction-specific. Dashboard and terminal
    demand recovery covers interruption after the durable result and before its
    normal finalization. Held accounting is never silently released here.
    """
    enter_gate(conn)
    rows = conn.execute("""SELECT c.* FROM lifecycle_claims c WHERE state='active'
      AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id()
      AND (kind IN ('public_writer','dashboard','review_write') OR kind='demand' AND EXISTS(
        SELECT FROM job_payload_demands d WHERE d.id::text=c.work_id
          AND d.status IN ('ready','deferred','failed','cancelled')
          AND d.settled_at<=clock_timestamp()-interval '180 seconds'))
      AND EXISTS(SELECT FROM capacity_reservations r WHERE r.claim_kind=c.kind AND r.claim_id=c.work_id AND r.generation=c.generation)
      AND NOT EXISTS(SELECT FROM capacity_reservations r WHERE r.claim_kind=c.kind AND r.claim_id=c.work_id
        AND (r.state='held' OR r.transaction_id=pg_current_xact_id()))
      ORDER BY c.kind,c.work_id LIMIT %s""", (min(limit,100),)).fetchall()
    for row in rows:
        cancel_claim(conn, ClaimRef(row['owner_token'],row['generation'],row['lease_until']))
    return len(rows)


def _terminal_batch(conn, limit, phase):
    if phase == 3:
        finalized = finalize_completed_producers(conn, min(limit,100))
        if finalized:
            return finalized
        # Settled callbacks also need a retained generation fence before removing
        # the row. A current generation is left intact, however old its timestamp.
        return conn.execute('''DELETE FROM capacity_reservations WHERE id IN
          (SELECT r.id FROM capacity_reservations r JOIN lifecycle_claims c
           ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE r.state<>'held'
           AND r.terminal_at<=clock_timestamp()-interval '168 hours'
           AND c.replay_floor>=r.generation AND c.generation>r.generation
           ORDER BY r.terminal_at,r.id LIMIT %s)''', (limit,)).rowcount
    if phase == 4:
        rows = conn.execute('''SELECT d.id,d.job_id FROM job_payload_demands d
          WHERE d.status IN ('ready','deferred','failed','cancelled')
          AND GREATEST(d.settled_at,d.consumed_at)<=clock_timestamp()-interval '168 hours'
          AND (d.protection_until IS NULL OR d.protection_until<=clock_timestamp())
          AND (d.consumed_at IS NULL OR d.consumption_applied_at>=d.consumed_at)
          AND NOT EXISTS(SELECT FROM generation_jobs g WHERE g.user_id=d.user_id AND g.job_id=d.job_id AND g.status IN ('pending','running'))
          AND NOT EXISTS(SELECT FROM job_payload_demands active WHERE active.user_id=d.user_id AND active.job_id=d.job_id
            AND active.status IN ('pending','running') AND COALESCE(active.lease_until,active.protection_until)>clock_timestamp())
          AND NOT EXISTS(SELECT FROM lifecycle_claims c WHERE c.kind='demand' AND c.work_id=d.id::text
            AND (c.state='active' OR c.generation<=d.claim_generation OR c.replay_floor<GREATEST(d.claim_generation,1)))
          ORDER BY d.settled_at,d.id LIMIT %s''', (limit,)).fetchall()
        acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in rows]))
        rows = [r for r in rows if r['job_id'] in acquired]
        return conn.execute('DELETE FROM job_payload_demands WHERE id=ANY(%s)', ([r['id'] for r in rows],)).rowcount if rows else 0
    return conn.execute('''DELETE FROM lifecycle_write_checks WHERE id IN
      (SELECT id FROM lifecycle_write_checks WHERE created_at<=clock_timestamp()-interval '168 hours'
       ORDER BY created_at,id LIMIT %s)''', (limit,)).rowcount


def _metrics(conn, scheduled):
    metrics = conn.execute('''SELECT pg_database_size(current_database()) AS physical,
      (SELECT COALESCE(sum(bytes),0) FROM capacity_reservations WHERE state='held') AS held,
      (SELECT COALESCE(sum(n_live_tup),0) FROM pg_stat_user_tables) AS live,
      (SELECT COALESCE(sum(n_dead_tup),0) FROM pg_stat_user_tables) AS dead,
      (SELECT wal_bytes FROM pg_stat_wal) AS wal,
      EXISTS(SELECT FROM capacity_reservations r LEFT JOIN lifecycle_claims c
       ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE r.state='held'
       AND (c.lease_until<=clock_timestamp() OR c.state<>'active' OR c.generation<>r.generation)) AS unresolved''').fetchone()
    guard = metrics['physical'] + metrics['held'] >= CEILING_BYTES
    conn.execute('''UPDATE lifecycle_maintenance_state SET last_success_at=clock_timestamp(),
      physical_bytes=%s,held_bytes=%s,live_tuples=%s,dead_tuples=%s,reusable_bytes=NULL,wal_bytes=%s,
      guard_active=%s,guard_scheduled_streak=CASE WHEN %s THEN
        CASE WHEN %s THEN guard_scheduled_streak+1 ELSE 0 END ELSE guard_scheduled_streak END
      WHERE singleton''', (metrics['physical'], metrics['held'], metrics['live'], metrics['dead'], metrics['wal'], guard, scheduled, guard))
    row = conn.execute('UPDATE lifecycle_maintenance_state SET action_needed=guard_scheduled_streak>=2 WHERE singleton RETURNING action_needed').fetchone()
    log.info('maintenance metrics: %s guard_active=%s reusable_bytes=unknown action_needed=%s', metrics, guard, row['action_needed'])
    if row['action_needed']:
        log.warning('maintenance action needed: physical guard persists; separately authorized compaction/capacity action may be required')
    return guard or metrics['unresolved']


def sweep(conn, claim: ClaimRef, dry_run: bool = True, max_rows: int = MAX_ROWS, *, scheduled: bool = False) -> SweepResult:
    if type(max_rows) is not int or not 1 <= max_rows <= MAX_ROWS:
        raise ValueError('max_rows must be in 1..20000')
    started = renewed = monotonic()
    deadline = started + DEADLINE_SECONDS
    used = retired = size = eligible = 0
    cursor = None
    phase = 0
    try:
        setup = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS - 5))
        validate_claim(setup, claim)
        if not setup.execute("SELECT 1 FROM lifecycle_claims WHERE kind='maintenance' AND work_id='singleton' AND owner_token=%s AND generation=%s", (claim.owner_token, claim.generation)).fetchone():
            raise RuntimeError('maintenance singleton claim required')
        state = setup.execute('SELECT cursor,next_phase FROM lifecycle_maintenance_state WHERE singleton').fetchone()
        cursor, phase = state['cursor'], state['next_phase']
        setup.commit()
        idle = 0
        payload_finished = versions_finished = False
        while used < max_rows and size < MAX_RETIRE_BYTES and monotonic() < deadline - 10 and idle < 6:
            if monotonic() >= renewed + RENEW_SECONDS - 10:
                # The preceding progress transaction has already committed.
                renewal = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS))
                renewing_at = monotonic()
                claim = renew_claim(renewal, claim, LEASE_SECONDS)
                renewal.commit()
                renewed = renewing_at
            end = min(deadline, renewed + RENEW_SECONDS) - 5
            batch = _TimedConnection(conn, end, end - 5)
            validate_claim(batch, claim)
            ctl = read_control(batch)
            if not ctl.maintenance_enabled:
                batch.commit()
                break
            effective_dry = dry_run or ctl.retirement_dry_run or not ctl.retirement_enabled or ctl.safety_stage != 'enforced'
            limit = min(BATCH_ROWS, max_rows - used)
            next_cursor = cursor
            r = b = e = 0
            if phase == 0:
                if payload_finished:
                    n = 0
                else:
                    n, r, b, e, next_cursor = _payload_batch(batch, cursor, limit, effective_dry, MAX_RETIRE_BYTES - size)
                    payload_finished = not n and not batch.yielded
            elif phase == 1:
                if versions_finished:
                    n = 0
                else:
                    n, r, b = _version_batch(batch, limit, effective_dry, MAX_RETIRE_BYTES - size)
                    versions_finished = effective_dry or not n
            elif phase == 2:
                n = _staging_batch(batch, limit)
            else:
                n = _terminal_batch(batch, limit, phase)
            next_phase = (phase + 1) % 6
            batch.execute('UPDATE lifecycle_maintenance_state SET cursor=%s,next_phase=%s,eligible_rows=%s,retired_rows=%s,retired_bytes=%s WHERE singleton', (next_cursor, next_phase, eligible + e, retired + r, size + b))
            batch.commit()
            # Report only durable work, including when a later phase times out.
            used += n
            retired += r
            size += b
            eligible += e
            cursor, phase = next_cursor, next_phase
            idle = idle + 1 if not n and not batch.yielded else 0
        health = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS))
        validate_claim(health, claim)
        blocked = _metrics(health, scheduled)
        health.commit()
        return SweepResult(retired, size, blocked, cursor)
    except _PhaseEnded:
        conn.rollback()
        log.info('maintenance time window exhausted; committed progress retained')
        return SweepResult(retired, size, True, cursor)


def pre_admission_maintenance(dsn: str | None) -> SweepResult:
    conn = None
    try:
        conn = db.connect(dsn)
        enter_gate(conn)
        ctl = read_control(conn)
        if not ctl.maintenance_enabled:
            conn.commit()
            return SweepResult(0, 0, False, None)
        claim = claim_work(conn, 'maintenance', 'singleton', LEASE_SECONDS)
        conn.commit()
        if claim is None:
            return SweepResult(0, 0, True, None)
        result = sweep(conn, claim, dry_run=ctl.retirement_dry_run)
        cancel_claim(conn, claim)
        conn.commit()
        return result
    except Exception:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                log.exception('maintenance rollback failed')
        log.exception('pre-admission maintenance failed; additions blocked, verification permitted')
        return SweepResult(0, 0, True, None)
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                log.exception('maintenance connection close failed')
