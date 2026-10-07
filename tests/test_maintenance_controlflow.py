"""Ordinary worker timing and reconnect flow; no DB security enforcement probes."""
from types import SimpleNamespace

import pytest

from job_discovery.lifecycle import maintenance as m
from job_discovery.lifecycle.types import SweepResult
import job_discovery.run as run


class Result:
    def __init__(self, one=None, rows=None):
        self.one, self.rows = one, rows
    def fetchone(self):
        return self.one
    def fetchall(self):
        return self.rows


@pytest.mark.parametrize('lock_cost', [0, 0.02, 0.11])
def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock_cost):
    clock = [0.0]
    renewal_times, commits, mutations, visited_phases = [], [], [], []
    payloads = {f'job:{i:03d}': [True, True] for i in range(250)}
    state = {'cursor': None, 'next_phase': 0}
    class Connection:
        timeout = 5000
        def execute(self, query, params=None):
            if query.startswith('SHOW transaction_isolation'):
                return Result({'transaction_isolation': 'read committed'})
            if query.startswith('SELECT 1 FROM lifecycle_claims'):
                return Result({'exists': 1})
            if query.startswith('SELECT cursor,next_phase'):
                return Result(state.copy())
            if query.startswith('SELECT id FROM jobs WHERE ('):
                return Result(rows=[{'id': key} for key in payloads if params[0] is None or key > params[0]][:params[2]])
            if query.startswith('SELECT j.id,'):
                return Result(rows=[{'id': key,'description_due': payloads[key][0],
                    'questions_due': payloads[key][1],'description_bytes': 2,'question_bytes': 2}
                    for key in params[0]])
            if query.startswith('SELECT id FROM jobs'):
                return Result(rows=[])
            if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
                clock[0] += lock_cost
            if query.startswith('SET LOCAL statement_timeout'):
                self.timeout = 5000  # Actual enter_gate resets this during lock_jobs.
            if "set_config('statement_timeout'" in query:
                self.timeout = int(params[0])
            if query.startswith('UPDATE lifecycle_maintenance_state SET cursor'):
                state.update(cursor=params[0], next_phase=params[1])
            if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
                mutations.append((clock[0], self.timeout))
                payloads[params[0]][0 if query.startswith('UPDATE jobs') else 1] = False
                clock[0] += 0.2
            return Result()
        def commit(self):
            commits.append(clock[0])
        def rollback(self):
            pass
    ctl = SimpleNamespace(maintenance_enabled=True,retirement_enabled=True,
                          retirement_dry_run=False,safety_stage='enforced')
    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
    monkeypatch.setattr(m,'validate_claim',lambda *a: None)
    monkeypatch.setattr(m,'read_control',lambda c: ctl)
    def renew(c, claim, seconds):
        assert commits and commits[-1] == clock[0]
        assert seconds == 120
        renewal_times.append(clock[0])
        return claim
    monkeypatch.setattr(m,'renew_claim',renew)
    monkeypatch.setattr(m,'_metrics',lambda *a: False)
    monkeypatch.setattr(m,'_version_batch',lambda *a: visited_phases.append(1) or (0,0,0))
    monkeypatch.setattr(m,'_staging_batch',lambda *a: visited_phases.append(2) or 0)
    monkeypatch.setattr(m,'_terminal_batch',lambda *a: visited_phases.append(a[-1]) or 0)
    conn = Connection()
    claim = SimpleNamespace(owner_token='ordinary-timing',generation=1)
    result = m.sweep(conn,claim,dry_run=False)
    assert clock[0] <= 90 + 1e-8
    assert mutations and all(start < 90 for start,_ in mutations)
    assert all(timeout <= min(5000,int((90-start)*1000)+1) for start,timeout in mutations)
    assert renewal_times
    assert max(b-a for a,b in zip([0,*renewal_times],[*renewal_times,clock[0]])) <= 30
    assert 0 < result.retired_rows < 500 and not result.blocked
    assert {1,2,3,4,5} <= set(visited_phases)
    # Fresh invocation resumes persisted Job cursor, including any half-done pair.
    total = result.retired_rows
    for _ in range(3):  # Finite fixture bound: <=4 fresh sweeps for every lock cost.
        if total == 500:
            break
        assert state['cursor'] is not None
        assert all(pair == [False,False] for key,pair in payloads.items() if key <= state['cursor'])
        start = clock[0]
        result = m.sweep(conn,claim,dry_run=False)
        assert 0 < result.retired_rows and not result.blocked
        assert clock[0] - start <= 90 + 1e-8
        total += result.retired_rows
    assert total == 500
    assert all(pair == [False,False] for pair in payloads.values())


@pytest.mark.parametrize('accounting_fails', [False, True])
def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
    finished, closes = [], []
    class Connection:
        def __init__(self, locked, broken=False):
            self.locked, self.broken = locked, broken
        def execute(self, *args):
            return Result({'locked':self.locked})
        def commit(self):
            pass
        def rollback(self):
            if self.broken:
                raise RuntimeError('broken rollback')
        def close(self):
            closes.append(self.locked)
    connections = iter([Connection(True,True),Connection(False)])
    monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
    monkeypatch.setattr(run,'load_targets',lambda: [])
    monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
    monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
    monkeypatch.setattr(run.db,'start_run',lambda c: 1)
    monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
    monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
    def finish(*args, **kw):
        finished.append(kw)
        if accounting_fails:
            raise RuntimeError('accounting unavailable')
    monkeypatch.setattr(run.db,'finish_run',finish)
    def source(token):
        raise RuntimeError('source unavailable')
    monkeypatch.setitem(run.ADAPTERS,'lever',source)
    def forbidden(*args,**kwargs):
        pytest.fail('aborted poll entered an optional phase')
    monkeypatch.setattr(run,'_run_prune',forbidden)
    monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
    monkeypatch.setattr('reviewer.run.review_all',forbidden)
    assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
    assert finished[0]['companies_failed'] == 1
    assert 'source unavailable' in finished[0]['notes']
    assert closes == [True,False]


def test_remaining_timeout_is_reapplied_after_lock_helpers(monkeypatch):
    clock = [0.0]
    class Connection:
        timeout = None
        def execute(self, query, params=None):
            if "set_config('statement_timeout'" in query:
                self.timeout = int(params[0])
            elif query.startswith('SET LOCAL statement_timeout'):
                self.timeout = 5000
            elif query.startswith('SHOW transaction_isolation'):
                return Result({'transaction_isolation':'read committed'})
            return Result()
    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
    raw = Connection()
    timed = m._TimedConnection(raw,2)
    m.lock_jobs(timed,['job'])
    clock[0] = 1.9
    timed.execute('SELECT 1')
    assert 0 < raw.timeout <= 101
    clock[0] = 2
    with pytest.raises(m._PhaseEnded):
        timed.execute('SELECT 1')


@pytest.mark.parametrize('phase', ['version','terminal-demand'])
def test_slow_candidate_locks_commit_smaller_version_and_demand_chunks(monkeypatch, phase):
    clock = [0.0]
    remaining = {f'job:{i:03d}' for i in range(250)}
    locked, commits = [], []
    class Connection:
        def execute(self,query,params=None):
            if query.startswith('SHOW transaction_isolation'):
                return Result({'transaction_isolation':'read committed'})
            if query.startswith('SELECT v.id') or query.startswith('SELECT d.id'):
                return Result(rows=[{'id':key,'job_id':key,'bytes':2} for key in sorted(remaining)])
            if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
                locked.append(params[0].removeprefix('lifecycle:job:'))
                clock[0] += 0.11
            if query.startswith('DELETE FROM job_versions') or query.startswith('DELETE FROM job_payload_demands'):
                assert set(params[0]) <= set(locked)
                remaining.difference_update(params[0])
                result = Result()
                result.rowcount = len(params[0])
                return result
            return Result()
        def commit(self):
            commits.append(clock[0])
    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
    raw = Connection()
    for _ in range(4):
        if not remaining:
            break
        before = len(remaining)
        locked.clear()
        start = clock[0]
        timed = m._TimedConnection(raw,start+25,start+20)
        if phase == 'version':
            m._version_batch(timed,2000,False)
        else:
            m._terminal_batch(timed,2000,4)
        timed.commit()
        assert clock[0] - start <= 25 and len(remaining) < before
        assert locked == sorted(locked)
    assert not remaining and commits  # <=4 committed chunks drain 250 slow keys.
