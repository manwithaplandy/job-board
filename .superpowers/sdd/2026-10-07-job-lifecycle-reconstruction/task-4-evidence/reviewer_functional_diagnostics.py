"""Offline ordinary scheduling/control-flow diagnostics. No database or network.

Run from the repository with:
PYTHONPATH=. .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/reviewer_functional_diagnostics.py
No lease/capacity/tenant enforcement is exercised or claimed by these doubles.
"""
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch
import job_discovery.lifecycle.maintenance as m
import job_discovery.run as run
from job_discovery.lifecycle.types import SweepResult

class Result:
    def __init__(self, one=None, rows=None):
        self.one, self.rows = one, rows
    def fetchone(self):
        return self.one
    def fetchall(self):
        return self.rows

clock = [0.0]
renewals = []
mutation_starts = []
ids = [f'job:{i:03d}' for i in range(250)]
class TimingConnection:
    def execute(self, query, params=None):
        if query.startswith('SELECT 1 FROM lifecycle_claims'):
            return Result({'exists': 1})
        if query.startswith('SELECT cursor,next_phase'):
            return Result({'cursor': None, 'next_phase': 0})
        if query.startswith('SELECT id FROM jobs'):
            return Result(rows=[{'id': key} for key in ids])
        if query.startswith('SELECT j.id,'):
            return Result(rows=[{'id': key, 'description_due': True, 'questions_due': True,
                                 'description_bytes': 2, 'question_bytes': 2} for key in ids])
        if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
            mutation_starts.append(clock[0])
            clock[0] += 0.2  # Each succeeds well inside the 5-second statement limit.
        return Result()
    def commit(self):
        pass
ctl = SimpleNamespace(maintenance_enabled=True, retirement_enabled=True,
                      retirement_dry_run=False, safety_stage='enforced')
with ExitStack() as stack:
    for name, value in {
        'monotonic': lambda: clock[0], 'validate_claim': lambda *a: None,
        'read_control': lambda c: ctl, 'lock_jobs': lambda *a: None,
        'renew_claim': lambda *a: renewals.append(clock[0]) or a[1],
        '_metrics': lambda *a: False,
    }.items():
        stack.enter_context(patch.object(m, name, value))
    result = m.sweep(TimingConnection(), SimpleNamespace(owner_token='offline', generation=1), dry_run=False)
print('TIMING: elapsed=%.1fs retired=%d mutations_started_after_90s=%d renewals=%s' %
      (clock[0], result.retired_rows, sum(t >= 90 for t in mutation_starts), renewals))
assert clock[0] > 90 and mutation_starts[-1] > 90 and not renewals

calls = []
class PollConnection:
    def __init__(self, locked, broken_rollback=False):
        self.locked, self.broken_rollback = locked, broken_rollback
    def execute(self, query, params=None):
        return Result({'locked': self.locked})
    def commit(self):
        pass
    def rollback(self):
        if self.broken_rollback:
            raise RuntimeError('ordinary broken session')
    def close(self):
        pass
connections = iter([PollConnection(True, True), PollConnection(False)])
def source(token):
    raise RuntimeError('ordinary adapter error')
with ExitStack() as stack:
    for obj, name, value in [
        (run, 'pre_admission_maintenance', lambda dsn: SweepResult(0,0,False,None)),
        (run, 'load_targets', lambda: []),
        (run.db, 'connect', lambda dsn: next(connections)),
        (run.db, 'over_size_ceiling', lambda c: (False,20,6000)),
        (run.db, 'start_run', lambda c: 1),
        (run.db, 'sync_seed', lambda *a: None),
        (run.db, 'active_companies', lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}]),
        (run.db, 'finish_run', lambda *a, **kw: calls.append('finish_run')),
        (run, '_run_prune', lambda c: calls.append('prune')),
    ]:
        stack.enter_context(patch.object(obj, name, value))
    stack.enter_context(patch.dict(run.ADAPTERS, {'lever': source}))
    stack.enter_context(patch('job_discovery.locations.resolve_new_locations', lambda c: calls.append('location_enrichment')))
    stack.enter_context(patch('reviewer.run.review_all', lambda c: calls.append('model_review')))
    run.run()
print('RECONNECT_LOCK_DENIED: later_phases=%s' % calls)
assert 'location_enrichment' in calls and 'model_review' in calls
