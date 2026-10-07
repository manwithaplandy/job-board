"""Ordinary source evidence, pagination and persisted scheduling contracts."""
from datetime import timedelta

import pytest

from tests.conftest import requires_db
from job_discovery.lifecycle import reconcile as r
from job_discovery.lifecycle.identity import migrate_identity_batch
from job_discovery.lifecycle.claims import cancel_claim
from job_discovery.adapters.completeness import SourceStatus
from job_discovery.lifecycle.types import Observation


def setup_source(conn, count=1, ats='lever', token='fixture'):
    cid = conn.execute("INSERT INTO companies(name,ats,token) VALUES ('Fixture',%s,%s) RETURNING id", (ats, token)).fetchone()['id']
    for i in range(count):
        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES (%s,%s,%s,'Role','https://example.test/job')", (f'{ats}:{token}:{i}', cid, str(i)))
    while migrate_identity_batch(conn):
        pass
    conn.execute('UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1 WHERE singleton')
    conn.commit()
    return conn.execute('SELECT * FROM source_accounts WHERE legacy_company_id=%s', (cid,)).fetchone()


def begin(conn, source):
    conn.execute('UPDATE source_accounts SET next_due_at=NULL WHERE id=%s', (source['id'],))
    pair = r.claim_due_source(conn)
    assert pair
    co, claim = pair
    enum = r.begin_enumeration(conn, co['id'], claim)
    conn.commit()
    return enum


def finish(conn, enum, complete=True):
    r.complete_enumeration(conn, enum, SourceStatus(complete=complete))
    conn.commit()
    while not r.reconcile_chunk(conn, enum):
        conn.commit()
    conn.commit()
    cancel_claim(conn, enum.claim)
    conn.commit()


@requires_db
def test_two_distinct_complete_misses_exact_24h_and_replay(conn):
    source = setup_source(conn)
    first = begin(conn, source)
    finish(conn, first)
    row = conn.execute('SELECT * FROM source_listings').fetchone()
    assert row['consecutive_complete_misses'] == 1
    assert row['source_availability'] != 'closed'
    second = begin(conn, source)
    # Fixture timestamps, not an application clock override.
    r.complete_enumeration(conn, second, SourceStatus())
    conn.execute("UPDATE source_enumerations SET completed_at=%s WHERE id=%s", (row['first_complete_miss_at']+timedelta(hours=24), second.id))
    assert r.reconcile_chunk(conn, second)
    assert r.reconcile_chunk(conn, second)
    row = conn.execute('SELECT * FROM source_listings').fetchone()
    assert row['consecutive_complete_misses'] == 2
    assert row['source_availability'] == 'closed'
    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at']
    conn.commit()


@requires_db
def test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset(conn):
    source = setup_source(conn)
    before = conn.execute('SELECT * FROM source_listings').fetchone()
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()")
    enum = begin(conn, source)
    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    sight = Observation('0', before['id'], 'unlisted', now)
    r.commit_sightings(conn, enum, [sight])
    conn.commit()
    r.commit_sightings(conn, enum, [sight])
    finish(conn, enum, False)
    after = conn.execute('SELECT * FROM source_listings').fetchone()
    assert after['successful_sighting_count'] == 1
    assert after['source_availability'] == 'open'
    assert after['discovery_anchor_at'] == before['discovery_anchor_at']
    assert after['job_id'] == before['job_id']
    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None


@requires_db
@pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
def test_empty_threshold(conn, count, expected):
    source = setup_source(conn, count)
    enum = begin(conn, source)
    finish(conn, enum)
    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status'] == expected
    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == (expected == 'complete')


@requires_db
def test_unknown_or_missing_never_closes_and_partial_never_counts(conn):
    source = setup_source(conn)
    enum = begin(conn, source)
    listing = conn.execute('SELECT * FROM source_listings').fetchone()
    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    r.commit_sightings(conn, enum, [Observation('0',listing['id'],'missing',now)])
    finish(conn, enum, False)
    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses'] == 0


@requires_db
def test_cancelled_enumeration_cannot_complete(conn):
    source = setup_source(conn)
    enum = begin(conn, source)
    cancel_claim(conn, enum.claim)
    conn.commit()
    with pytest.raises(RuntimeError, match='fenced|stale'):
        r.complete_enumeration(conn, enum, SourceStatus())
    conn.rollback()


@requires_db
def test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence(conn):
    import psycopg
    from psycopg.rows import dict_row
    from tests.conftest import TEST_DSN
    source = setup_source(conn, 105)
    enum = begin(conn,source)
    from job_discovery.models import Posting
    r.stage_postings(conn,enum,[Posting('extra','Role','u')])
    r.complete_enumeration(conn,enum,SourceStatus())
    assert not r.reconcile_chunk(conn,enum,100)
    conn.commit()
    # Fresh worker/connection reads the committed checkpoint without replaying
    # the first 100 effects. Its existing lease remains bound to this run.
    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
        assert r.reconcile_chunk(fresh,enum,100)
        fresh.commit()
    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == 105
    cancel_claim(conn,enum.claim)
    conn.commit()
    newer = begin(conn,source)
    listing = conn.execute('SELECT * FROM source_listings ORDER BY external_id LIMIT 1').fetchone()
    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    r.commit_sightings(conn,newer,[Observation(listing['external_id'],listing['id'],'seen',now)])
    # A completion can represent a feed started before a newer direct sighting.
    conn.execute('UPDATE source_enumerations SET started_at=%s WHERE id=%s',(now-timedelta(hours=25),newer.id))
    finish(conn,newer)
    row = conn.execute('SELECT * FROM source_listings WHERE id=%s',(listing['id'],)).fetchone()
    assert row['consecutive_complete_misses'] == 0
    assert row['source_availability'] == 'open'


@requires_db
def test_less_than_24_hours_is_not_a_qualifying_second_miss(conn):
    source = setup_source(conn)
    first = begin(conn,source)
    finish(conn,first)
    miss = conn.execute('SELECT first_complete_miss_at FROM source_listings').fetchone()['first_complete_miss_at']
    second = begin(conn,source)
    r.complete_enumeration(conn,second,SourceStatus())
    conn.execute('UPDATE source_enumerations SET completed_at=%s WHERE id=%s',(miss+timedelta(hours=24,microseconds=-1),second.id))
    assert r.reconcile_chunk(conn,second)
    conn.commit()
    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None


@requires_db
@pytest.mark.parametrize('budget_kind',['requests','time'])
def test_scheduler_finite_six_cycle_bound_across_families_and_request_budget(conn,monkeypatch,budget_kind):
    from job_discovery import http
    from job_discovery.adapters import smartrecruiters
    families = ['greenhouse','lever','ashby','workable','smartrecruiters','workday']
    for family in families:
        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
    # Force the enormous source first; it exhausts every fresh request budget.
    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()-interval '1 day' WHERE ats<>'smartrecruiters'")
    conn.commit()
    monkeypatch.setattr(r,'BOARD_REQUESTS',2)
    clock=[0.0]
    if budget_kind=='time':
        from job_discovery.adapters import completeness
        monkeypatch.setattr(r,'monotonic',lambda:clock[0])
        monkeypatch.setattr(completeness,'monotonic',lambda:clock[0])
        monkeypatch.setattr(r,'BOARD_SECONDS',1)
    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
    calls = []
    def get(url,**kwargs):
        assert conn.info.transaction_status.name == 'IDLE'
        calls.append(url)
        if 'smartrecruiters' in url:
            if budget_kind=='time':
                clock[0]+=2
            offset = url.split('offset=')[-1]
            return {'content':[{'id':offset,'name':'Role'}]}
        if 'lever' in url:
            return [{'id':'0','text':'Role','hostedUrl':'https://example.test/job'}]
        if 'greenhouse' in url:
            return {'jobs':[{'id':'0','title':'Role','absolute_url':'https://example.test/job'}]}
        if 'ashby' in url:
            return {'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':'2026-10-01T00:00:00Z'}]}
        return {'jobs':[{'shortcode':'0','title':'Role'}]}
    def post(url,**kwargs):
        assert conn.info.transaction_status.name == 'IDLE'
        calls.append(url)
        return {'jobPostings':[{'externalPath':'0','title':'Role'}],'total':1}
    monkeypatch.setattr(http,'get_json',get)
    monkeypatch.setattr(http,'post_json',post)
    for _ in range(6):
        r.verify_due_sources(conn,max_boards=1)
    rows = conn.execute('SELECT ats,last_attempt_at,last_outcome FROM source_accounts').fetchall()
    assert all(row['last_attempt_at'] for row in rows)
    assert sum(row['last_outcome']=='complete' for row in rows)==5
    assert len(calls)==(7 if budget_kind=='requests' else 6)
    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
    # Another fixture day: huge source again exhausts; every small source still
    # receives a turn within the same six fresh invocations.
    conn.execute('UPDATE source_accounts SET next_due_at=NULL')
    conn.commit()
    for _ in range(6):
        r.verify_due_sources(conn,max_boards=1)
    assert conn.execute('SELECT min(enumeration_sequence) n FROM source_accounts').fetchone()['n']==2
    assert len(calls)==(14 if budget_kind=='requests' else 12)


@requires_db
def test_failure_disabled_backoff_and_deliberate_exclusion(conn):
    source = setup_source(conn)
    conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
    for days in [1,2,4,7,7]:
        enum = begin(conn,source)
        finish(conn,enum,False)
        row = conn.execute('SELECT next_due_at,last_attempt_at FROM source_accounts').fetchone()
        assert row['next_due_at']==row['last_attempt_at'].replace(hour=0,minute=0,second=0,microsecond=0)+timedelta(days=days)
    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate',next_due_at=NULL")
    assert r.claim_due_source(conn) is None


@requires_db
def test_ordinary_poll_calls_full_corpus_path_above_guard_without_users(conn,monkeypatch):
    import os
    from job_discovery import run, http
    source = setup_source(conn)
    monkeypatch.setenv('DATABASE_URL',os.environ['TEST_DATABASE_URL'])
    monkeypatch.setattr(run,'load_targets',lambda: [])
    monkeypatch.setattr(run.db,'over_size_ceiling',lambda c:(True,6001,6000))
    calls=[]
    monkeypatch.setattr(http,'get_json',lambda url,**kw:calls.append(url) or [])
    assert run.run()['ok']==1
    assert len(calls)==1
    assert conn.execute('SELECT last_complete_success_at FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()['last_complete_success_at']
    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None


@requires_db
def test_storage_blocked_attempt_is_truthful_and_does_not_certify_absence(conn,monkeypatch,caplog):
    from job_discovery import http
    setup_source(conn)
    monkeypatch.setattr(r,'claim_work',lambda *args:None)  # Ordinary integration boundary double; no capacity probes.
    calls=[]
    def healthy(url,**kw):
        assert conn.info.transaction_status.name=='IDLE'
        calls.append(url)
        return []
    monkeypatch.setattr(http,'get_json',healthy)
    result=r.verify_due_sources(conn,max_boards=1)
    assert result['failed']==0 and len(calls)==1
    assert 'healthy; storage-blocked, reconciliation-deferred' in caplog.text
    assert conn.execute('SELECT count(*) n FROM source_enumerations').fetchone()['n']==0
    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses']==0


@requires_db
def test_ashby_republication_and_unlisted_keep_frozen_age(conn,monkeypatch):
    from job_discovery import http
    setup_source(conn,1,'ashby')
    before=conn.execute('SELECT * FROM source_listings').fetchone()
    for published in ['2026-01-01T00:00:00Z','2026-10-06T00:00:00Z']:
        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':published}]})
        conn.execute('UPDATE source_accounts SET next_due_at=NULL')
        conn.commit()
        r.verify_due_sources(conn,max_boards=1)
    after=conn.execute('SELECT * FROM source_listings').fetchone()
    assert after['discovery_anchor_at']==before['discovery_anchor_at']
    assert after['discovery_expires_at']==before['discovery_expires_at']
    assert after['successful_sighting_count']==2
    assert after['source_availability']=='open'
    assert conn.execute('SELECT bool_and(public_metadata=\'{"kind":"unlisted"}\') ok FROM enumeration_members').fetchone()['ok']


@requires_db
def test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives(conn,monkeypatch):
    import psycopg
    from psycopg.rows import dict_row
    from tests.conftest import TEST_DSN
    from job_discovery import http
    from job_discovery.lifecycle.types import ClaimRef
    setup_source(conn,100,'smartrecruiters')
    # Exercise the intentional next-page worker interruption, independently of
    # CPU time spent admitting new metadata. Budget exhaustion has separate tests.
    # Only the public source scheduler clock is fixed; DB lease time is unchanged.
    from job_discovery.adapters import completeness
    monkeypatch.setattr(r,'monotonic',lambda:0.0)
    monkeypatch.setattr(completeness,'monotonic',lambda:0.0)
    calls=[]
    def interrupted(url,**kw):
        calls.append(url)
        if len(calls)>1:
            raise KeyboardInterrupt('ordinary simulated worker interruption')
        return {'content':[{'id':str(i),'name':'Role'} for i in range(100)],'totalFound':101}
    monkeypatch.setattr(http,'get_json',interrupted)
    with pytest.raises(KeyboardInterrupt):
        r.verify_due_sources(conn,max_boards=1)
    conn.rollback()
    # Discard the caller connection; a new worker sees both membership and
    # source attempt ordering, and restarts mutable pagination from page zero.
    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
        assert fresh.execute('SELECT count(*) n FROM enumeration_members').fetchone()['n']==100
        assert fresh.execute('SELECT min(successful_sighting_count) n FROM source_listings').fetchone()['n']==1
        claim=fresh.execute("SELECT * FROM lifecycle_claims WHERE kind='source'").fetchone()
        cancel_claim(fresh,ClaimRef(claim['owner_token'],claim['generation'],claim['lease_until']))
        fresh.commit()
        requested=[]
        def restarted(url,**kw):
            requested.append(url)
            return {'content':[{'id':'0','name':'Role'}],'totalFound':1}
        monkeypatch.setattr(http,'get_json',restarted)
        r.verify_due_sources(fresh,max_boards=1)
        assert requested and 'offset=0' in requested[0]
        assert fresh.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==2
        assert fresh.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1


@requires_db
def test_new_corpus_sources_registered_in_bounded_slices_without_reactivating_exclusions(conn):
    from job_discovery import db
    source=setup_source(conn)
    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate'")
    conn.execute("INSERT INTO companies(name,ats,token,active,poll_failures) VALUES ('Failed','lever','failed',false,%s),('Unknown','ashby','unknown',false,0),('New','greenhouse','new',true,0)", (db.POLL_FAILURE_DEACTIVATE,))
    assert db.sync_source_accounts(conn,2)==2
    conn.commit()
    rows=conn.execute('SELECT public_board_ref,exclusion_state FROM source_accounts ORDER BY public_board_ref').fetchall()
    assert {'public_board_ref':'fixture','exclusion_state':'deliberate'} in rows
    assert {'public_board_ref':'failed','exclusion_state':'failure_disabled'} in rows
    assert {'public_board_ref':'unknown','exclusion_state':'unknown'} in rows
    assert conn.execute('SELECT legacy_company_id FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()


@requires_db
def test_explicit_removed_evidence_only_closes_exact_identity(conn):
    source=setup_source(conn,2)
    enum=begin(conn,source)
    listing=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
    now=conn.execute('SELECT clock_timestamp() t').fetchone()['t']
    r.commit_sightings(conn,enum,[Observation('0',listing['id'],'removed',now)])
    finish(conn,enum,False)
    rows=conn.execute('SELECT external_id,closed_at FROM jobs ORDER BY external_id').fetchall()
    assert rows[0]['closed_at'] and rows[1]['closed_at'] is None


@requires_db
def test_storage_deferred_request_budget_is_partial_not_a_source_failure(conn,monkeypatch,caplog):
    from job_discovery import http
    from job_discovery.adapters import smartrecruiters
    setup_source(conn,1,'smartrecruiters')
    monkeypatch.setattr(r,'claim_work',lambda *a:None)
    monkeypatch.setattr(r,'BOARD_REQUESTS',1)
    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'content':[{'id':'0','name':'Role'}],'totalFound':2})
    r.verify_due_sources(conn,max_boards=1)
    assert 'partial; storage-blocked, reconciliation-deferred' in caplog.text
    assert 'attempted: failed' not in caplog.text


@requires_db
def test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget(conn,monkeypatch,caplog):
    from job_discovery import http
    families=['greenhouse','lever','ashby','workable','smartrecruiters','workday']
    for family in families:
        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
    before=conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()
    conn.commit()
    calls=[]
    def get(url,**kw):
        calls.append(url)
        if 'lever' in url:
            return []
        return {'content':[],'totalFound':0} if 'smartrecruiters' in url else {'jobs':[]}
    def post(url,**kw):
        calls.append(url)
        return {'jobPostings':[],'total':0}
    monkeypatch.setattr(http,'get_json',get)
    monkeypatch.setattr(http,'post_json',post)
    class FixtureDay:
        # Test-local replacement of this scheduler's UTC day expression only;
        # no production clock override or claim/lease/capacity behavior changes.
        def __init__(self,day):
            self.day=day
        def execute(self,query,params):
            query=query.replace('floor(extract(epoch FROM clock_timestamp())/86400)::bigint','%s::bigint')
            return conn.execute(query,(self.day,*params))
        def commit(self):
            conn.commit()
    for day in range(6):
        r.verify_storage_blocked(FixtureDay(day),max_boards=1,deadline=r.monotonic()+60)
    assert len(calls)==6 and len(set(calls))==6
    assert all(str(row['id']) in caplog.text for row in before)
    assert conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()==before


@requires_db
@pytest.mark.parametrize('ats',['greenhouse','lever','ashby'])
@pytest.mark.parametrize('defect',['missing_title','duplicate'])
def test_fix1_single_response_good_positives_commit_despite_later_bad_item(conn,monkeypatch,ats,defect):
    from job_discovery import http
    setup_source(conn,3,ats)
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
    conn.commit()
    good={'id':'0','title':'Role','text':'Role','absolute_url':'https://example.test/job',
          'hostedUrl':'https://example.test/job','jobUrl':'https://example.test/job'}
    bad=dict(good,id='1')
    bad.pop('title')
    bad.pop('text')
    items=[good,bad if defect=='missing_title' else good]
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:items if ats=='lever' else {'jobs':items})
    r.verify_due_sources(conn,max_boards=1)
    rows=conn.execute('SELECT * FROM source_listings ORDER BY external_id').fetchall()
    assert rows[0]['successful_sighting_count']==1
    assert rows[0]['source_availability']=='open'
    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()['closed_at'] is None
    assert all(row['consecutive_complete_misses']==0 for row in rows)
    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status']=='partial'


class SourceFixtureClock:
    """Advance only source scheduling/evidence time, never claim or lease time."""
    def __init__(self,conn,clock):
        self.conn,self.clock=conn,clock
    def __getattr__(self,name):
        return getattr(self.conn,name)
    def execute(self,query,params=None):
        from psycopg import sql
        # Test-only replacement in precisely the source operations under test.
        if isinstance(query,str):
            if ('UPDATE source_accounts SET last_attempt_at=' in query
                or 'UPDATE source_accounts SET last_outcome=' in query
                or 'UPDATE source_enumerations SET status=' in query
                or 'SELECT s.* FROM source_accounts s' in query):
                literal=sql.Literal(self.clock[0]).as_string(self.conn)+'::timestamptz'
                query=query.replace('clock_timestamp()',literal)
        return self.conn.execute(query,params)


@requires_db
@pytest.mark.parametrize('failure_disabled',[False,True])
def test_fix1_daily_entrypoint_eligibility_with_nonzero_feed_duration(conn,monkeypatch,failure_disabled):
    from datetime import UTC,datetime
    from job_discovery import http
    setup_source(conn)
    if failure_disabled:
        conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
    conn.commit()
    slot=datetime(2026,10,1,tzinfo=UTC)
    clock=[slot]
    scheduled=SourceFixtureClock(conn,clock)
    calls=[]
    def feed(*a,**kw):
        calls.append(clock[0])
        clock[0]+=timedelta(seconds=10 if len(calls)==2 else 20)
        if failure_disabled:
            raise ValueError('ordinary fixture unavailable source')
        return []
    monkeypatch.setattr(http,'get_json',feed)
    for backoff in ([1,2,4,7] if failure_disabled else [1,1,1,1]):
        before=len(calls)
        r.verify_due_sources(scheduled,max_boards=1)
        assert len(calls)==before+1
        next_slot=slot+timedelta(days=backoff)
        row=conn.execute('SELECT next_due_at FROM source_accounts').fetchone()
        assert row['next_due_at']==next_slot
        if not failure_disabled and len(calls)==2:
            assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
        if not failure_disabled and len(calls)==3:
            assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is not None
        conn.commit()
        slot=next_slot
        clock[0]=slot
    # Scheduling slots do not relax the separate 24-hour successful evidence rule.


@requires_db
@pytest.mark.parametrize('interruption',['deadline','after_complete'])
def test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart(conn,monkeypatch,interruption):
    import psycopg
    from psycopg.rows import dict_row
    from tests.conftest import TEST_DSN
    from job_discovery import http
    source=setup_source(conn,205)
    conn.commit()
    calls=[]
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:calls.append(1) or [{'id':'extra','text':'Role','hostedUrl':'https://example.test/job'}])
    clock=[0.0]
    monkeypatch.setattr(r,'monotonic',lambda:clock[0])
    actual=r.reconcile_chunk
    chunks=[]
    def limited(worker,enum,limit=500):
        if interruption=='after_complete' and not chunks:
            chunks.append('interrupted')
            raise KeyboardInterrupt('ordinary worker interruption after membership completion')
        done=actual(worker,enum,limit)
        chunks.append(done)
        clock[0]+=2
        return done
    monkeypatch.setattr(r,'reconcile_chunk',limited)
    saved=None
    progress=[]
    for turn in range(4):
        with psycopg.connect(TEST_DSN,row_factory=dict_row) as worker:
            if turn==0 and interruption=='after_complete':
                with pytest.raises(KeyboardInterrupt):
                    r.verify_due_sources(worker,max_boards=1,seconds=1)
            else:
                r.verify_due_sources(worker,max_boards=1,seconds=1)
        # Every invocation has discarded its worker and connection; it receives
        # no in-memory EnumerationRef/checkpoint from the preceding invocation.
        conn.rollback()
        enum=conn.execute('SELECT * FROM source_enumerations WHERE source_id=%s',(source['id'],)).fetchone()
        identity=(enum['id'],enum['sequence'],enum['started_at'],enum['completed_at'])
        if saved is None:
            saved=identity
        assert identity==saved
        progress.append(conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'])
        conn.commit()
        if enum['reconciled_at']:
            break
    assert progress==([100,200,205] if interruption=='deadline' else [0,100,200,205])
    assert len(calls)==1
    assert conn.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==1
    # Task7 admits the actually observed 'extra' identity; it has no miss.
    assert conn.execute("SELECT min(consecutive_complete_misses) n FROM source_listings WHERE external_id<>'extra'").fetchone()['n']==1
    assert conn.execute("SELECT consecutive_complete_misses FROM source_listings WHERE external_id='extra'").fetchone()['consecutive_complete_misses']==0


@requires_db
@pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
    from job_discovery import http
    setup_source(conn,3,'workable')
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
    conn.commit()
    good={'shortcode':'0','title':'Role'}
    bad={'shortcode':'1'} if defect=='missing_title' else (good if defect=='duplicate' else {'title':'No ID'})
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[good,bad]})
    r.verify_due_sources(conn,max_boards=1)
    row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
    assert row['successful_sighting_count']==1 and row['source_availability']=='open'
    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()['closed_at'] is None
    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status']=='partial'
    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0


@requires_db
@pytest.mark.parametrize('family',['smartrecruiters','workday'])
def test_fix1_paged_mixed_nonobject_retains_good_positive(conn,monkeypatch,family):
    from job_discovery import http
    setup_source(conn,3,family,'fixture:wd5:External' if family=='workday' else 'fixture')
    if family=='smartrecruiters':
        payload={'content':[{'id':'0','name':'Role'},None],'totalFound':2}
    else:
        payload={'jobPostings':[{'externalPath':'0','title':'Role'},None],'total':2}
    monkeypatch.setattr(http,'get_json',lambda *a,**kw:payload)
    monkeypatch.setattr(http,'post_json',lambda *a,**kw:payload)
    r.verify_due_sources(conn,max_boards=1)
    row=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
    assert row['successful_sighting_count']==1 and row['source_availability']=='open'
    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status'] in {'partial','failed'}
    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
