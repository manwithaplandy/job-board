import os

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
