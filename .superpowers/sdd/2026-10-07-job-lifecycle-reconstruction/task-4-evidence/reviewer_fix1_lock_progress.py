"""Offline ordinary timing diagnostic; no DB/network/enforcement probes.
PYTHONPATH=. .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/reviewer_fix1_lock_progress.py
"""
from types import SimpleNamespace
from unittest.mock import patch
from contextlib import ExitStack
from job_discovery.lifecycle import maintenance as m

class Result:
    def __init__(self, one=None, rows=None):
        self.one, self.rows = one, rows
    def fetchone(self):
        return self.one
    def fetchall(self):
        return self.rows
clock = [0.0]
state = {'cursor':None,'next_phase':0}
mutations = []
rollbacks = []
class Connection:
    def execute(self, query, params=None):
        if query.startswith('SHOW transaction_isolation'):
            return Result({'transaction_isolation':'read committed'})
        if query.startswith('SELECT 1 FROM lifecycle_claims'):
            return Result({'exists':1})
        if query.startswith('SELECT cursor,next_phase'):
            return Result(state.copy())
        if query.startswith('SELECT id FROM jobs WHERE ('):
            return Result(rows=[{'id':f'job:{i:03d}'} for i in range(250)])
        if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
            clock[0] += 0.11 # Individually successful; below the 2-second lock timeout.
        if query.startswith('UPDATE jobs') or query.startswith('DELETE FROM job_questions'):
            mutations.append(query)
        if query.startswith('UPDATE lifecycle_maintenance_state SET cursor'):
            state.update(cursor=params[0],next_phase=params[1])
        return Result(rows=[])
    def commit(self):
        pass
    def rollback(self):
        rollbacks.append(clock[0])
ctl = SimpleNamespace(maintenance_enabled=True,retirement_enabled=True,retirement_dry_run=False,safety_stage='enforced')
with ExitStack() as stack:
    for name,value in {'monotonic':lambda:clock[0], 'validate_claim':lambda *a:None,
                       'read_control':lambda c:ctl, '_metrics':lambda *a:False}.items():
        stack.enter_context(patch.object(m,name,value))
    conn = Connection()
    for attempt in range(1,4):
        start=clock[0]
        result=m.sweep(conn,SimpleNamespace(owner_token='offline',generation=1),dry_run=False)
        print(f'attempt={attempt} duration={clock[0]-start:.2f}s retired={result.retired_rows} blocked={result.blocked} cursor={state["cursor"]!r} phase={state["next_phase"]} total_mutations={len(mutations)}')
assert len(rollbacks)==3 and not mutations and state=={'cursor':None,'next_phase':0}
print('Confirmed: repeated successful per-Job lock calls exhaust the phase before any durable payload/cursor progress; every fresh sweep retries the same prefix.')
