import os

import pytest

from tests.conftest import requires_db


@requires_db
def test_release_probe_reports_state_without_changing_it(conn, monkeypatch):
    from tools.lifecycle_release import probe

    monkeypatch.setenv('DATABASE_URL', os.environ['TEST_DATABASE_URL'])
    monkeypatch.setenv('RAILWAY_GIT_COMMIT_SHA', 'a' * 40)
    before = conn.execute('SELECT * FROM lifecycle_control').fetchone()
    conn.commit()
    report = probe()
    assert report['transaction_read_only'] == 'on'
    assert report['revision'] == 'a' * 40
    assert report['source_accounts'] == report['source_listings'] == 0
    assert report['safety_stage'] == 'legacy'
    assert report['activation_generation'] == 0
    assert conn.execute('SELECT * FROM lifecycle_control').fetchone() == before
    assert conn.execute('SELECT count(*) AS n FROM lifecycle_claims').fetchone()['n'] == 0


@requires_db
@pytest.mark.parametrize('job_count,clock,mapped,batches,complete', [
    (2005, None, 2000, 20, False),
    (125, [0, 0, 0, 241, 241], 100, 1, False),
    (125, [0, 0, 241], 0, 0, False),
    (25, None, 25, 2, True),
])
def test_first_release_turn_is_bounded_and_refuses_a_second_turn(conn, monkeypatch, job_count, clock, mapped, batches, complete):
    from tools import lifecycle_release as release

    monkeypatch.setenv('DATABASE_URL', os.environ['TEST_DATABASE_URL'])
    monkeypatch.setenv('RAILWAY_GIT_COMMIT_SHA', 'b' * 40)
    monkeypatch.setenv('RAILWAY_SERVICE_ID', release.REVIEWER_SERVICE)
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', release.PRODUCTION_ENVIRONMENT)
    monkeypatch.setenv('RAILWAY_GIT_BRANCH', 'main')
    if clock is not None:
        ticks = iter(clock)
        monkeypatch.setattr(release, 'monotonic', lambda: next(ticks))
    conn.execute("INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','release-fixture')")
    conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) SELECT 'job-'||n,1,n::text,'Engineer','https://example.test/'||n FROM generate_series(1,%s) n", (job_count,))
    conn.commit()
    result = release.first_backfill()
    assert result['mapped'] == mapped
    assert result['batches'] == batches
    assert result['corpus_complete'] is complete
    monkeypatch.setattr(release, 'monotonic', lambda: 0)
    with pytest.raises(RuntimeError, match='pristine'):
        release.first_backfill()
    control = conn.execute('SELECT * FROM lifecycle_control').fetchone()
    assert control['safety_stage'] == 'collect'
    assert control['activation_generation'] == 1
    assert control['identity_enabled']
    assert control['retirement_dry_run']
    assert not any(control[k] for k in ('source_enabled', 'maintenance_enabled', 'hydration_enabled', 'feed_enabled', 'retirement_enabled', 'archive_ever_activated', 'export_enabled'))
    assert conn.execute('SELECT count(*) AS n FROM source_listings').fetchone()['n'] == mapped
    assert conn.execute('SELECT count(*) AS n FROM jobs').fetchone()['n'] == job_count
