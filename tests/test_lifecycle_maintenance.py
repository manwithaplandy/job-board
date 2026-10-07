"""Ordinary maintenance business behavior; no adversarial/tenant review probes."""
import importlib

import pytest

from tests.conftest import requires_db
from tests.test_prune import _company, _job


def module():
    return importlib.import_module('job_discovery.lifecycle.maintenance')


def enable(conn):
    conn.execute("UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1")
    conn.commit()


def claim(conn):
    from job_discovery.lifecycle.claims import claim_work
    value = claim_work(conn, 'maintenance', 'singleton', 120)
    conn.commit()
    return value


@requires_db
def test_dry_run_global_expiry_and_persisted_cursor(conn):
    m = module()
    cid = _company(conn, 'inactive', active=False)
    ids = [_job(conn, cid, str(i)) for i in range(3)]
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '721 hours'")
    conn.commit()
    enable(conn)
    c = claim(conn)
    first = m.sweep(conn, c, max_rows=1)
    second = m.sweep(conn, c, max_rows=1)
    assert first.cursor == ids[0] and second.cursor == ids[1]
    assert first.retired_rows == second.retired_rows == 0
    assert conn.execute('SELECT count(*) AS n FROM jobs WHERE description IS NOT NULL').fetchone()['n'] == 3
    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 1


@requires_db
def test_readiness_forces_dry_run_even_when_caller_requests_retirement(conn):
    m = module()
    cid = _company(conn, 'dry')
    _job(conn, cid, '1')
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
    conn.commit()
    enable(conn)
    assert m.sweep(conn, claim(conn), dry_run=False).retired_rows == 0
    assert conn.execute('SELECT description FROM jobs').fetchone()['description'] == 'jd'


@requires_db
def test_maintenance_cutover_permanently_disables_legacy_prune(conn):
    from job_discovery.prune import prune_jobs
    cid = _company(conn, 'cutover')
    jid = _job(conn, cid, '1', closed_days=40)
    enable(conn)
    assert prune_jobs(conn)['closed_deleted'] == 0
    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=false,activation_generation=activation_generation+1')
    conn.commit()
    assert prune_jobs(conn)['closed_deleted'] == 0
    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid


def test_pre_admission_failure_is_blocked(monkeypatch):
    m = module()
    def fail(*a, **kw):
        raise RuntimeError('unavailable')
    monkeypatch.setattr(m.db, 'connect', fail)
    assert m.pre_admission_maintenance(None).blocked


def test_maintenance_precedes_empty_targets_and_poll_lock(monkeypatch):
    import job_discovery.run as run
    from job_discovery.lifecycle.types import SweepResult
    order = []
    class Result:
        def fetchone(self):
            return {'locked': False}
    class Conn:
        def execute(self, *a):
            order.append('lock')
            return Result()
        def close(self):
            pass
    monkeypatch.setattr(run, 'pre_admission_maintenance', lambda d: order.append('maintenance') or SweepResult(0, 0, False, None), raising=False)
    monkeypatch.setattr(run, 'load_targets', lambda: order.append('targets') or [])
    monkeypatch.setattr(run.db, 'connect', lambda d: Conn())
    run.run()
    assert order == ['maintenance', 'targets', 'lock']


@pytest.mark.parametrize('description_age,question_age,last_use,expected', [
    (721, 169, None, 2), (719, 169, None, 1), (721, 167, None, 1),
    (721, 169, 1, 0), (None, None, None, 0),
])
@requires_db
def test_payload_ttl_uses_capture_or_actual_use_not_sightings(conn, description_age, question_age, last_use, expected):
    m = module()
    cid = _company(conn, 'ttl', active=False)
    jid = _job(conn, cid, '1')
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-make_interval(hours=>%s),description_last_used_at=clock_timestamp()-make_interval(hours=>%s),last_seen_at=clock_timestamp()", (description_age, last_use))
    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at,last_used_at) VALUES(%s,'[]',clock_timestamp()-make_interval(hours=>%s),clock_timestamp()-make_interval(hours=>%s))", (jid, question_age, last_use))
    conn.commit()
    from job_discovery.lifecycle.locks import enter_gate
    enter_gate(conn)
    result = m._payload_batch(conn, None, 2000, False)
    conn.commit()
    assert result[1] == expected
    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid


@requires_db
@pytest.mark.parametrize('kind', ['approve', 'correction', 'package', 'score', 'edit', 'generation', 'demand', 'snapshot'])
def test_persisted_work_excludes_payload_retirement(conn, kind):
    m = module()
    cid = _company(conn, 'work')
    jid = _job(conn, cid, '1')
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
    uid = '33333333-3333-3333-3333-333333333333'
    queries = {
        'approve': "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,%s,'v','approve')",
        'correction': "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES(%s,%s,'approve')",
        'package': "INSERT INTO application_packages(user_id,job_id) VALUES(%s,%s)",
        'score': "INSERT INTO resume_scores(user_id,job_id) VALUES(%s,%s)",
        'edit': "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES(%s,%s,'edit')",
        'generation': "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,%s,'prepare')",
        'demand': "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES(%s,%s,'review')",
        'snapshot': "INSERT INTO job_payload_demands(user_id,job_id,kind,status,description_snapshot,snapshot_captured_at) VALUES(%s,%s,'review','failed','used',clock_timestamp())",
    }
    conn.execute(queries[kind], (uid, jid))
    conn.commit()
    enable(conn)
    result = m.sweep(conn, claim(conn), max_rows=10)
    assert result.retired_rows == 0
    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
    assert conn.execute('SELECT description FROM jobs').fetchone()['description'] == 'jd'


def enumeration(conn, *, completed=False, hours=169, members=4):
    from job_discovery.lifecycle.claims import claim_work
    source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref,enumeration_sequence) VALUES('lever','cleanup',1) RETURNING id").fetchone()['id']
    c = claim_work(conn, 'source', str(source), 180)
    eid = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status,started_at,reconciled_at)
      VALUES(%s,1,%s,%s,%s,clock_timestamp()-make_interval(hours=>%s),CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END) RETURNING id""",
      (source, c.owner_token, c.generation, 'complete' if completed else 'running', hours, completed, hours)).fetchone()['id']
    conn.commit()
    for start in range(1, members+1, 500):
        conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
        conn.commit()
    conn.execute("INSERT INTO reconciliation_checkpoints(enumeration_id,generation,reconciled_count,completed_at) VALUES(%s,%s,23,CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END)", (eid, c.generation, completed, hours))
    conn.commit()
    return source, eid, c


@requires_db
@pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
    m = module()
    source, eid, old = enumeration(conn, completed=completed, hours=hours)
    enable(conn)
    m.sweep(conn, claim(conn), max_rows=50)
    assert (conn.execute('SELECT id FROM source_enumerations WHERE id=%s', (eid,)).fetchone() is None) == cleaned
    floor = conn.execute('SELECT replay_floor FROM source_accounts WHERE id=%s', (source,)).fetchone()['replay_floor']
    assert floor == (1 if cleaned else 0)
    persisted = conn.execute("SELECT generation,replay_floor FROM lifecycle_claims WHERE kind='source'").fetchone()
    assert (persisted['generation'] > old.generation) == cleaned


@requires_db
def test_staging_cleanup_is_capped_and_resumes_from_committed_fence(conn):
    m = module()
    source, eid, old = enumeration(conn, members=21005)
    enable(conn)
    c = claim(conn)
    result = m.sweep(conn, c)
    remaining = conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n']
    assert remaining == 1008  # 20,000 total units includes the 3-row fence.
    assert result.retired_rows == 0
    assert conn.execute('SELECT reason FROM lifecycle_staging_cleanup').fetchone()['reason'] == 'abandoned'
    from tests.lifecycle_helpers import open_sessions
    from tests.conftest import TEST_DSN
    restarted = open_sessions(TEST_DSN,1)[0]
    try:
        m.sweep(restarted, c)
    finally:
        restarted.close()
    assert conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n'] == 0
    assert conn.execute('SELECT count(*) AS n FROM source_enumerations').fetchone()['n'] == 0
    assert conn.execute('SELECT replay_floor FROM source_accounts WHERE id=%s',(source,)).fetchone()['replay_floor'] == 1


@requires_db
def test_completed_requires_committed_reconciliation_checkpoint(conn):
    m = module()
    _, eid, _ = enumeration(conn, completed=True, hours=25)
    conn.execute('UPDATE reconciliation_checkpoints SET completed_at=NULL WHERE enumeration_id=%s', (eid,))
    conn.commit()
    enable(conn)
    m.sweep(conn, claim(conn))
    assert conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n'] == 4


@requires_db
def test_null_payloads_and_unknown_capture_never_invent_expiry(conn):
    m = module()
    cid = _company(conn, 'null')
    jid = _job(conn, cid, '1', description=None)
    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'null',clock_timestamp()-interval '8 days')", (jid,))
    conn.commit()
    enable(conn)
    m.sweep(conn, claim(conn))
    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0


def test_budgets_and_deadline_are_explicit():
    m = module()
    assert (m.BATCH_ROWS, m.MAX_ROWS, m.DEADLINE_SECONDS, m.LEASE_SECONDS, m.RENEW_SECONDS) == (2000,20000,90,120,30)
    for cap in (0,20001,-1,True):
        with pytest.raises(ValueError):
            m.sweep(None,None,max_rows=cap)


@requires_db
def test_retirement_worker_with_future_readiness_keeps_identity_and_has_no_external_effects(conn, monkeypatch):
    # Worker-only readiness double exercises future live behavior without changing
    # the installed SQL activation barrier or enabling the real control row.
    from dataclasses import replace
    m = module()
    cid = _company(conn, 'retire')
    jid = _job(conn, cid, '1')
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')", (jid,))
    conn.commit()
    enable(conn)
    actual = m.read_control
    monkeypatch.setattr(m, 'read_control', lambda c: replace(actual(c),safety_stage='enforced',retirement_enabled=True,retirement_dry_run=False))
    def forbidden(*a, **kw):
        raise AssertionError('maintenance attempted external side effect')
    monkeypatch.setattr('reviewer.run.review_all', forbidden)
    monkeypatch.setattr('job_discovery.http.get_json', forbidden)
    monkeypatch.setattr('job_discovery.locations.resolve_new_locations', forbidden)
    monkeypatch.setattr('socket.create_connection', forbidden)
    result = m.sweep(conn, claim(conn), dry_run=False)
    assert result.retired_rows == 2 and result.retired_bytes == 4
    assert conn.execute('SELECT id,description,description_pruned FROM jobs').fetchone() == {'id':jid,'description':None,'description_pruned':True}
    assert conn.execute('SELECT count(*) AS n FROM job_questions').fetchone()['n'] == 0
    assert conn.execute('SELECT retirement_dry_run FROM lifecycle_control').fetchone()['retirement_dry_run']


@requires_db
def test_only_scheduled_guarded_sweeps_increment_action_streak(conn, monkeypatch):
    m = module()
    enable(conn)
    c = claim(conn)
    monkeypatch.setattr(m, 'CEILING_BYTES', 1)  # Metric branch only, no capacity mechanism changes.
    assert m.sweep(conn,c).blocked
    assert conn.execute('SELECT guard_scheduled_streak FROM lifecycle_maintenance_state').fetchone()['guard_scheduled_streak'] == 0
    m.sweep(conn,c,scheduled=True)
    assert not conn.execute('SELECT action_needed FROM lifecycle_maintenance_state').fetchone()['action_needed']
    m.sweep(conn,c,scheduled=True)
    metrics = conn.execute('SELECT * FROM lifecycle_maintenance_state').fetchone()
    assert metrics['action_needed'] and metrics['physical_bytes'] > 0
    assert metrics['reusable_bytes'] is None and metrics['live_tuples'] >= 0


@requires_db
def test_deleted_reservation_detail_requires_persisted_claim_floor(conn):
    # Ordinary settled/fenced-record retention. No forged-token/expiry probes.
    from job_discovery.lifecycle.claims import claim_work, cancel_claim
    from job_discovery.lifecycle.capacity import reserve_capacity
    m = module()
    c = claim_work(conn,'test-retention','one',180)
    reservation = reserve_capacity(conn,c,10)
    conn.commit()
    cancel_claim(conn,c)
    conn.commit()
    # Terminal timestamps are immutable; verify recent fenced details remain.
    assert m._terminal_batch(conn,2000,3) == 0
    conn.commit()
    assert conn.execute('SELECT state FROM capacity_reservations WHERE id=%s',(reservation.id,)).fetchone()['state'] == 'fenced'
    assert conn.execute("SELECT replay_floor FROM lifecycle_claims WHERE kind='test-retention'").fetchone()['replay_floor'] == c.generation


@requires_db
def test_only_safely_archived_unreferenced_superseded_versions_retire(conn):
    from job_discovery.lifecycle.identity import migrate_identity_batch
    from job_discovery.lifecycle.locks import enter_gate
    m = module()
    cid = _company(conn,'versions')
    jid = _job(conn,cid,'1')
    migrate_identity_batch(conn)
    listing = conn.execute('SELECT id FROM source_listings WHERE job_id=%s',(jid,)).fetchone()['id']
    for revision in range(1,16):
        conn.execute("""INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
          VALUES(%s,%s,%s,repeat('a',64),'{}',clock_timestamp(),clock_timestamp()-make_interval(hours=>%s))""",
          (jid,listing,revision,745 if revision in (5,6) else 1))
    conn.execute('UPDATE jobs SET description_version_id=(SELECT id FROM job_versions WHERE revision=1)')
    conn.execute('UPDATE source_listings SET current_revision=15,archived_revision=5,current_version_id=(SELECT id FROM job_versions WHERE revision=15)')
    conn.commit()
    enter_gate(conn)
    n,retired,_ = m._version_batch(conn,2000,False)
    conn.commit()
    assert n == retired == 4  # 2/3/4 exceed ten superseded; 5 is >30d.
    remaining = [r['revision'] for r in conn.execute('SELECT revision FROM job_versions ORDER BY revision')]
    assert remaining == [1,*range(6,16)]  # 1 referenced, 6 unarchived, 15 current.
    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid


@requires_db
def test_terminal_retention_deletes_only_fenced_details_and_preserves_held(conn):
    from job_discovery.lifecycle.claims import claim_work, cancel_claim
    from job_discovery.lifecycle.capacity import reserve_capacity
    m = module()
    settled = claim_work(conn,'retention','terminal',180)
    first = reserve_capacity(conn,settled,10)
    reserve_capacity(conn,settled,10)
    conn.commit()
    cancel_claim(conn,settled)
    conn.commit()
    active = claim_work(conn,'retention','held',180)
    held = reserve_capacity(conn,active,10)
    conn.commit()
    class RetentionClock:
        """Test-only future retention cutoff; no lease/trigger clock is replaced."""
        def execute(self, query, params=None):
            return conn.execute(query.replace("clock_timestamp()-interval '168 hours'", "clock_timestamp()+interval '1 hour'"), params)
    assert m._terminal_batch(RetentionClock(),1,3) == 1
    conn.commit()
    assert m._terminal_batch(RetentionClock(),2000,3) == 1
    conn.commit()
    assert conn.execute('SELECT id,state FROM capacity_reservations').fetchall() == [{'id':held.id,'state':'held'}]
    assert not conn.execute('SELECT id FROM capacity_reservations WHERE id=%s',(first.id,)).fetchone()
    assert conn.execute("SELECT replay_floor FROM lifecycle_claims WHERE kind='retention' AND work_id='terminal'").fetchone()['replay_floor'] == settled.generation


@requires_db
def test_retirement_byte_budget_defers_remaining_payload(conn):
    from job_discovery.lifecycle.locks import enter_gate
    m = module()
    cid = _company(conn,'bytes')
    jid = _job(conn,cid,'1')
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')",(jid,))
    conn.commit()
    enter_gate(conn)
    _,rows,size,_,_ = m._payload_batch(conn,None,2000,False,byte_limit=2)
    conn.commit()
    assert rows == 1 and size == 2
    assert conn.execute('SELECT questions FROM job_questions').fetchone()['questions'] == []


@requires_db
def test_slow_successful_payload_statements_commit_resumable_progress(conn, monkeypatch):
    """Virtual worker elapsed time; DB lease clocks and guards stay real/unmodified."""
    from dataclasses import replace
    m = module()
    cid = _company(conn,'slow')
    conn.execute("""INSERT INTO jobs(id,company_id,external_id,title,url,description,description_captured_at)
      SELECT 'lever:slow:'||lpad(n::text,3,'0'),%s,n::text,'Eng','u','jd',clock_timestamp()-interval '31 days'
      FROM generate_series(1,250) n""",(cid,))
    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) SELECT id,'[]',clock_timestamp()-interval '8 days' FROM jobs")
    conn.commit()
    enable(conn)
    c = claim(conn)
    clock = [0.0]
    starts, renewals, commits = [], [], []
    class SlowStatements:
        def execute(self, query, params=None):
            result = conn.execute(query,params)
            if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
                starts.append(clock[0])
                clock[0] += 0.2
            return result
        def commit(self):
            conn.commit()
            commits.append(clock[0])
        def __getattr__(self,name):
            return getattr(conn,name)
    actual_control, actual_renew = m.read_control, m.renew_claim
    monkeypatch.setattr(m,'read_control',lambda db: replace(actual_control(db),safety_stage='enforced',retirement_enabled=True,retirement_dry_run=False))
    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
    def renew(db,ref,seconds):
        assert commits[-1] == clock[0]
        renewals.append(clock[0])
        return actual_renew(db,ref,seconds)
    monkeypatch.setattr(m,'renew_claim',renew)
    first = m.sweep(SlowStatements(),c,dry_run=False)
    assert clock[0] <= 90 and all(t < 90 for t in starts)
    assert renewals and max(b-a for a,b in zip([0,*renewals],[*renewals,clock[0]])) <= 30
    assert 0 < first.retired_rows < 500
    assert conn.execute('SELECT cursor FROM lifecycle_maintenance_state').fetchone()['cursor'] == first.cursor
    second = m.sweep(SlowStatements(),c,dry_run=False)
    assert first.retired_rows + second.retired_rows == 500
    assert conn.execute('SELECT count(*) AS n FROM jobs WHERE description IS NULL').fetchone()['n'] == 250
    assert conn.execute('SELECT count(*) AS n FROM job_questions').fetchone()['n'] == 0
