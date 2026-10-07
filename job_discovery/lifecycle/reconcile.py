"""Full-corpus, bounded source evidence. Callers own short transactions.

Enumeration pagination never resumes from an offset: interruptions retain positive
receipts, then a fresh sequence starts at page zero. Only complete membership may
supply absence. Public payload admission remains a separate caller responsibility.
"""
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime
import logging
from time import monotonic
from uuid import UUID

from psycopg.types.json import Jsonb

from job_discovery.adapters.completeness import SourceStatus, SourceBudgetExceeded
from .capacity import reserve_capacity, bind_reservation, settle_capacity
from .claims import claim_work, validate_claim, renew_claim, cancel_claim
from .config import read_control
from .locks import enter_gate, lock_jobs
from .types import ClaimRef, EnumerationRef, Observation

log = logging.getLogger(__name__)
CHUNK = 100  # Multiple row effects per identity stay below 500 per transaction.
BOARD_SECONDS = 60
BOARD_REQUESTS = 50
BOARD_ROWS = 10000


class StorageBlocked(RuntimeError):
    pass


@contextmanager
def _write(conn, claim, scope, job_id=None, size=32768):
    """Use the established reservation contract; never bypass enforced charging."""
    reservation = reserve_capacity(conn, claim, size)
    if reservation is None:
        raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
    bind_reservation(conn, reservation, job_id=job_id, scope=scope)
    yield
    settle_capacity(conn, reservation)


def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
    enter_gate(conn)
    if not read_control(conn).source_enabled:
        return None
    # Last-attempt ordering is essential: an interrupted huge board goes behind
    # untouched small boards even if neither has ever completed successfully.
    source = conn.execute("""SELECT s.* FROM source_accounts s
        WHERE exclusion_state IN ('enabled','failure_disabled')
          AND (next_due_at IS NULL OR next_due_at<=clock_timestamp())
          AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
            AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
        ORDER BY last_attempt_at NULLS FIRST,last_complete_success_at NULLS FIRST,id
        LIMIT 1""").fetchone()
    if not source:
        return None
    claim = claim_work(conn, 'source', str(source['id']), 180)
    if claim is None:
        raise StorageBlocked('source claim storage blocked; reconciliation deferred')
    with _write(conn, claim, 'source_accounts'):
        conn.execute("""UPDATE source_accounts SET last_attempt_at=clock_timestamp(),
            last_outcome='attempting',claim_owner_token=%s,claim_generation=%s,
            lease_until=%s WHERE id=%s""", (claim.owner_token,claim.generation,claim.lease_until,source['id']))
    return source, claim


def _check(conn, enum):
    validate_claim(conn, enum.claim)
    row = conn.execute("""SELECT e.* FROM source_enumerations e JOIN source_accounts s ON s.id=e.source_id
      WHERE e.id=%s AND e.source_id=%s AND e.sequence=%s AND e.sequence>s.replay_floor
       AND e.owner_token=%s AND e.generation=%s FOR UPDATE OF e""",
      (enum.id,enum.source_id,enum.sequence,enum.claim.owner_token,enum.claim.generation)).fetchone()
    if row is None:
        raise RuntimeError('stale or fenced source enumeration')
    return row


def begin_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef:
    validate_claim(conn, claim)
    if not conn.execute("SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s AND generation=%s", (str(source_id),claim.owner_token,claim.generation)).fetchone():
        raise RuntimeError('source claim mismatch')
    with _write(conn, claim, 'source_accounts'):
        row = conn.execute("""UPDATE source_accounts SET enumeration_sequence=enumeration_sequence+1
            WHERE id=%s RETURNING enumeration_sequence""", (source_id,)).fetchone()
    with _write(conn, claim, 'source_enumerations'):
        enum = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status)
            VALUES(%s,%s,%s,%s,'running') RETURNING id""",
            (source_id,row['enumeration_sequence'],claim.owner_token,claim.generation)).fetchone()
    return EnumerationRef(enum['id'],source_id,row['enumeration_sequence'],claim)


def _positive(conn, enum, listing, kind, observed_at):
    if kind not in {'seen','unlisted','removed','expired'}:
        return  # Missing URLs or failed direct checks are unknown, never closure.
    if enum.sequence < max(listing['last_membership_sequence'],listing['last_direct_verification_sequence']):
        return
    if listing['successful_last_observed_at'] and observed_at < listing['successful_last_observed_at']:
        return
    removed = kind in {'removed','expired'}
    with _write(conn, enum.claim, 'source_listings', listing['job_id']):
        conn.execute("""UPDATE source_listings SET successful_last_observed_at=%s,
           successful_sighting_count=successful_sighting_count+%s,
           last_membership_sequence=GREATEST(last_membership_sequence,%s),
           last_direct_verification_sequence=CASE WHEN %s THEN %s ELSE last_direct_verification_sequence END,
           source_availability=%s,consecutive_complete_misses=0,first_complete_miss_at=NULL
           WHERE id=%s""", (observed_at,0 if removed else 1,enum.sequence,removed,enum.sequence,
                           'closed' if removed else 'open',listing['id']))
    with _write(conn, enum.claim, 'jobs', listing['job_id']):
        conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
                     (removed,observed_at,listing['job_id']))


def commit_sightings(conn, enumeration: EnumerationRef, observations: list[Observation]) -> None:
    if len(observations) > CHUNK:
        raise ValueError(f'sighting chunk exceeds {CHUNK}')
    enter_gate(conn)
    listings = conn.execute("""SELECT * FROM source_listings WHERE source_account_id=%s
        AND id=ANY(%s)""", (enumeration.source_id,[o.listing_id for o in observations])).fetchall()
    lock_jobs(conn, [r['job_id'] for r in listings])
    e = _check(conn, enumeration)
    if e['status'] != 'running':
        raise RuntimeError('enumeration is not running')
    by_id = {r['id']:r for r in listings}
    for o in observations:
        if not isinstance(o.observed_at,datetime) or o.observed_at.tzinfo is None:
            raise ValueError('observation requires aware database timestamp')
        listing = by_id.get(o.listing_id)
        if listing is None or listing['external_id'] != o.id:
            raise ValueError('observation must match exact source listing')
        if o.kind not in {'seen','unlisted','removed','expired'}:
            continue
        with _write(conn, enumeration.claim, 'enumeration_members'):
            inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
                VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING external_id""",
                (enumeration.id,o.id,Jsonb({'kind':o.kind}))).fetchone()
        if inserted:
            _positive(conn, enumeration, listing, o.kind, o.observed_at)


def stage_postings(conn, enum, postings):
    """Retain IDs and tiny evidence only; no unused detail/raw payload persistence."""
    if len(postings) > CHUNK:
        raise ValueError('posting checkpoint too large')
    ids = [p.external_id for p in postings]
    enter_gate(conn)
    listings = conn.execute('SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)', (enum.source_id,ids)).fetchall()
    by_id = {row['external_id']:row for row in listings}
    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    observations = [Observation(p.external_id,by_id[p.external_id]['id'],
                     'unlisted' if (p.raw or {}).get('isListed') is False else 'seen',now)
                    for p in postings if p.external_id in by_id]
    commit_sightings(conn,enum,observations)
    # Unknown IDs participate in exact membership, but Task 7 owns lean admission.
    for external_id in ids:
        if len(external_id.encode()) > 2048:
            raise ValueError('source identity exceeds bounded staging limit')
        if external_id not in by_id:
            with _write(conn,enum.claim,'enumeration_members'):
                conn.execute("INSERT INTO enumeration_members VALUES(%s,%s,'{}') ON CONFLICT DO NOTHING", (enum.id,external_id))


def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatus) -> None:
    e = _check(conn,enumeration)
    if e['status'] in {'complete','partial','failed'}:
        return
    if e['status'] != 'running':
        raise RuntimeError('enumeration is not running')
    empty = not conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s LIMIT 1', (enumeration.id,)).fetchone()
    prior_open = conn.execute("""SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
       WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
    suspicious = empty and prior_open > 20
    status = 'complete' if verdict.complete and not suspicious else ('failed' if verdict.failed else 'partial')
    outcome = 'suspicious_empty' if suspicious else status
    with _write(conn,enumeration.claim,'source_enumerations'):
        conn.execute('UPDATE source_enumerations SET status=%s,completed_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=%s', (status,enumeration.id))
    with _write(conn,enumeration.claim,'source_accounts'):
        conn.execute("""UPDATE source_accounts SET last_outcome=%s,
          last_complete_success_at=CASE WHEN %s='complete' THEN clock_timestamp() ELSE last_complete_success_at END,
          failure_streak=CASE WHEN %s='complete' THEN 0 ELSE failure_streak+1 END,
          suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
          next_due_at=clock_timestamp()+interval '24 hours' *
             CASE WHEN exclusion_state='failure_disabled' AND %s<>'complete'
                  THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END
          WHERE id=%s""", (outcome,status,status,suspicious,status,enumeration.source_id))


def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool:
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError('reconciliation limit must be 1..500')
    enter_gate(conn)
    e = conn.execute('SELECT * FROM source_enumerations WHERE id=%s',(enumeration.id,)).fetchone()
    if e is None:
        raise RuntimeError('stale or fenced source enumeration')
    if e['status'] not in {'complete','partial','failed'}:
        raise RuntimeError('cannot reconcile unfinished enumeration')
    checkpoint = conn.execute('SELECT * FROM reconciliation_checkpoints WHERE enumeration_id=%s', (enumeration.id,)).fetchone()
    if checkpoint and checkpoint['completed_at']:
        _check(conn,enumeration)
        return True
    cursor = checkpoint['last_external_id'] if checkpoint else None
    rows = []
    if e['status'] == 'complete':
        rows = conn.execute("""SELECT l.* FROM source_listings l WHERE source_account_id=%s
            AND (%s::text IS NULL OR external_id>%s) ORDER BY external_id LIMIT %s""",
            (enumeration.source_id,cursor,cursor,min(limit,CHUNK))).fetchall()
    lock_jobs(conn,[r['job_id'] for r in rows])
    e = _check(conn,enumeration)
    for row in rows:
        if (row['last_membership_sequence'] >= enumeration.sequence
            or row['last_direct_verification_sequence'] >= enumeration.sequence
            or row['last_complete_miss_sequence'] >= enumeration.sequence
            or (row['successful_last_observed_at'] and row['successful_last_observed_at'] >= e['started_at'])):
            continue
        if conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s AND external_id=%s', (enumeration.id,row['external_id'])).fetchone():
            continue
        with _write(conn,enumeration.claim,'source_listings',row['job_id']):
            conn.execute("""UPDATE source_listings SET
               consecutive_complete_misses=LEAST(2,consecutive_complete_misses+1),
               first_complete_miss_at=COALESCE(first_complete_miss_at,%s),
               last_complete_miss_sequence=%s,last_miss_enumeration_id=%s,
               source_availability=CASE WHEN first_complete_miss_at IS NOT NULL
                 AND %s>=first_complete_miss_at+interval '24 hours' THEN 'closed' ELSE source_availability END
               WHERE id=%s""", (e['completed_at'],enumeration.sequence,enumeration.id,e['completed_at'],row['id']))
        with _write(conn,enumeration.claim,'jobs',row['job_id']):
            conn.execute("""UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s
                AND EXISTS(SELECT FROM source_listings WHERE id=%s AND source_availability='closed')""", (e['completed_at'],row['job_id'],row['id']))
    cursor = rows[-1]['external_id'] if rows else cursor
    done = len(rows) < min(limit,CHUNK)
    with _write(conn,enumeration.claim,'reconciliation_checkpoints'):
        conn.execute("""INSERT INTO reconciliation_checkpoints(enumeration_id,generation,last_external_id,reconciled_count,completed_at)
            VALUES(%s,%s,%s,%s,CASE WHEN %s THEN clock_timestamp() END)
            ON CONFLICT(enumeration_id) DO UPDATE SET last_external_id=EXCLUDED.last_external_id,
            reconciled_count=reconciliation_checkpoints.reconciled_count+EXCLUDED.reconciled_count,
            completed_at=EXCLUDED.completed_at""", (enumeration.id,enumeration.claim.generation,cursor,len(rows),done))
    with _write(conn,enumeration.claim,'source_accounts'):
        conn.execute('UPDATE source_accounts SET reconciliation_cursor=%s WHERE id=%s', (cursor,enumeration.source_id))
    if done:
        with _write(conn,enumeration.claim,'source_enumerations'):
            conn.execute('UPDATE source_enumerations SET reconciled_at=clock_timestamp() WHERE id=%s', (enumeration.id,))
    return done


def verify_due_sources(conn, *, max_boards=100, seconds=300):
    """Scheduled verification precedes admission and ignores all user matching."""
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import source_budget
    result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0}
    deadline = monotonic()+seconds
    for _ in range(max_boards):
        if monotonic() >= deadline:
            break
        try:
            pair = claim_due_source(conn)
            conn.commit()
        except StorageBlocked:
            conn.rollback()
            verify_storage_blocked(conn, max_boards=max_boards, deadline=deadline)
            break
        if pair is None:
            break
        source, claim = pair
        try:
            enum = begin_enumeration(conn,source['id'],claim)
            conn.commit()
        except StorageBlocked:
            conn.rollback()
            cancel_claim(conn,claim)
            conn.commit()
            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
            break
        chunk = []
        verdict = SourceStatus(complete=False)
        renewed = monotonic()
        try:
            def pulse():
                # No SQL transaction spans network, and each bounded request
                # starts with a renewed lease (including empty duplicate pages).
                renew_claim(conn,claim)
                conn.commit()
            with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
                postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
                count = 0
                for posting in postings:
                    count += 1
                    if count > BOARD_ROWS:
                        break
                    chunk.append(posting)
                    if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
                        stage_postings(conn,enum,chunk)
                        conn.commit()
                        chunk = []
                        claim = renew_claim(conn,claim)
                        conn.commit()
                        enum = replace(enum,claim=claim)
                        renewed = monotonic()
                verdict = SourceStatus(complete=postings.complete)
        except StorageBlocked:
            conn.rollback()
            log.warning("source evidence storage blocked; reconciliation deferred")
            cancel_claim(conn,claim)
            conn.commit()
            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
            break
        except SourceBudgetExceeded:
            verdict = SourceStatus(complete=False)
            conn.rollback()
        except Exception:
            log.exception('source enumeration failed or interrupted: %s',source['id'])
            verdict = SourceStatus(complete=False,failed=True)
            conn.rollback()
        try:
            if chunk:
                stage_postings(conn,enum,chunk)
                conn.commit()
            complete_enumeration(conn,enum,verdict)
            conn.commit()
            while True:
                done = reconcile_chunk(conn,enum)
                conn.commit()
                if done or monotonic() >= deadline:
                    break
                claim = renew_claim(conn,claim)
                conn.commit()
                enum = replace(enum,claim=claim)
            status = conn.execute('SELECT status FROM source_enumerations WHERE id=%s',(enum.id,)).fetchone()['status']
            result['ok' if status == 'complete' else 'failed'] += 1
            conn.commit()
        except StorageBlocked:
            conn.rollback()
            health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
            log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
        finally:
            conn.rollback()
            cancel_claim(conn,claim)
            conn.commit()
    return result


def verify_storage_blocked(conn, *, max_boards, deadline):
    """Read-only fallback: healthy feeds are storage-deferred, never source-failed.

    Existing enforced source metadata writes require physical reservations. Do
    not weaken that contract: report health in logs until persistence can resume.
    """
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import source_budget
    sources = conn.execute("""WITH due AS (SELECT *,row_number() OVER(ORDER BY last_attempt_at NULLS FIRST,id)-1 AS position,
         count(*) OVER() AS total FROM source_accounts
         WHERE exclusion_state IN ('enabled','failure_disabled')
         AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()))
       SELECT * FROM due ORDER BY mod(position-mod(floor(extract(epoch FROM clock_timestamp())/86400)::bigint,total)+total,total)
       LIMIT %s""", (max_boards,)).fetchall()
    conn.commit()
    for source in sources:
        if monotonic() >= deadline:
            break
        try:
            with source_budget(min(BOARD_SECONDS,deadline-monotonic()),BOARD_REQUESTS):
                feed = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
                for count, _ in enumerate(feed,1):
                    if count >= BOARD_ROWS:
                        break
                health = 'healthy' if feed.complete else 'partial'
        except SourceBudgetExceeded:
            health = 'partial'
        except Exception:
            health = 'failed'
        log.warning('source %s attempted: %s; storage-blocked, reconciliation-deferred',source['id'],health)
