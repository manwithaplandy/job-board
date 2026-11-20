"""Offline component tests; these never contact Supabase."""
import asyncio
import importlib.util
import json
from datetime import datetime, timezone, timedelta

import httpx
import pytest

NOW = datetime(2026, 10, 14, tzinfo=timezone.utc)
TOKEN = 'fixture-secret-never-output'


def test_reader_exists():
    assert importlib.util.find_spec('supabase_metrics') is not None


def read(disk=None, metrics=None, contract=True, handler=None, now=NOW):
    from supabase_metrics.core import _read, _Contract
    disk = disk if disk is not None else dict(timestamp=NOW.isoformat(), metrics=dict(fs_size_bytes=10000000000, fs_avail_bytes=8000000000, fs_used_bytes=2000000000))
    metrics = metrics if metrics is not None else '# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} 10 1791936000000\n'
    requests = []
    def respond(request):
        requests.append(request)
        if handler:
            return handler(request)
        return httpx.Response(200, content=json.dumps(disk).encode()) if request.url.path.endswith('/util') else httpx.Response(200, text=metrics)
    verified = _Contract(1048576, {'project': 'fdhspmavadgucktetzoi', 'instance': 'primary', 'volume': 'data'}, 'primary', 'data') if contract else None
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await _read(client, lambda: now, contract=verified, sleep=lambda _: asyncio.sleep(0))
    return asyncio.run(run()), requests


def test_normalized_fixture_and_fixed_requests():
    result, requests = read()
    assert result['status'] == 'ok'
    assert result['resident_wal_bytes'] == 10485760
    assert result['operationally_eligible'] is True
    assert len(requests) == 2
    assert all(r.method == 'GET' and r.url.host == 'api.supabase.com' for r in requests)
    assert {r.url.path for r in requests} == {'/v1/projects/fdhspmavadgucktetzoi/config/disk/util', '/v1/projects/fdhspmavadgucktetzoi/analytics/endpoints/metrics'}
    assert TOKEN not in json.dumps(result)


def test_unverified_source_fails_closed():
    result, _ = read(contract=False)
    assert result['status'] == 'incomplete'
    assert result['resident_wal_bytes'] is None
    assert result['operationally_eligible'] is False
    assert 'source_contract_unverified' in result['errors']


@pytest.mark.parametrize('metrics,code', [
    ('pg_wal_size_mb 10', 'wal_type_invalid'),
    ('# TYPE pg_wal_size_mb counter\npg_wal_size_mb 10', 'wal_type_invalid'),
    ('# TYPE pg_wal_size_mb gauge\npg_wal_size_mb 10', 'wal_identity_unverified'),
    ('# TYPE pg_wal_size_mb gauge\n', 'wal_missing'),
    ('# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} NaN 1791936000000', 'wal_invalid'),
    ('# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} 10', 'wal_timestamp_missing'),
])
def test_wal_failures(metrics, code):
    result, _ = read(metrics=metrics)
    assert result['status'] != 'ok'
    assert code in result['errors']


def test_duplicate_wal_rejected():
    text = '# TYPE pg_wal_size_mb gauge\n' + 'pg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} 10 1791936000000\n' * 2
    result, _ = read(metrics=text)
    assert result['status'] == 'invalid'
    assert 'wal_ambiguous' in result['errors']


@pytest.mark.parametrize('value', [-1, float('inf'), True, '10', 10000000001])
def test_invalid_disk(value):
    result, _ = read(disk=dict(timestamp=NOW.isoformat(), metrics=dict(fs_size_bytes=10000000000, fs_avail_bytes=value, fs_used_bytes=1)))
    assert result['status'] == 'invalid'


@pytest.mark.parametrize('delta,status', [(91, 'stale'), (-6, 'invalid'), (90, 'ok'), (-5, 'ok')])
def test_source_age_at_return(delta, status):
    result, _ = read(now=NOW+timedelta(seconds=delta))
    assert result['status'] == status


@pytest.mark.parametrize('status,attempts', [(401, 1), (403, 1), (302, 1), (500, 2), (429, 2)])
def test_http_errors_sanitized_bounded(status, attempts):
    result, requests = read(handler=lambda _: httpx.Response(status, text=TOKEN, headers={'location': 'https://evil.example/'+TOKEN}))
    assert result['status'] == 'unavailable'
    assert len(requests) == attempts
    assert TOKEN not in json.dumps(result)


def test_timeout_bounded_and_redacted():
    def handler(request):
        raise httpx.ReadTimeout(TOKEN, request=request)
    result, requests = read(handler=handler)
    assert len(requests) == 2
    assert result['errors'] == ['transport_unavailable']


def test_body_cap():
    result, _ = read(handler=lambda _: httpx.Response(200, content=b'x'*65537))
    assert result['errors'] == ['response_too_large']


def test_no_credentials_no_requests(monkeypatch):
    from supabase_metrics import get_supabase_storage_metrics
    monkeypatch.delenv('SUPABASE_METRICS_PAT', raising=False)
    result = get_supabase_storage_metrics()
    assert result['status'] == 'unavailable'
    assert result['errors'] == ['credential_missing']


def test_cli_no_secret_or_traceback(monkeypatch, capsys):
    from supabase_metrics.__main__ import main
    monkeypatch.delenv('SUPABASE_METRICS_PAT', raising=False)
    assert main([]) == 1
    assert json.loads(capsys.readouterr().out)['errors'] == ['credential_missing']
    assert main(['--url', TOKEN]) == 2
    assert TOKEN not in capsys.readouterr().out


def test_long_retry_after_stops_without_sleeping():
    result, requests = read(handler=lambda _: httpx.Response(429, headers={'retry-after': '30'}))
    assert result['errors'] == ['deadline_exceeded']
    assert len(requests) == 1


def test_transient_failure_then_success():
    counts = {}
    def handler(request):
        path = request.url.path
        counts[path] = counts.get(path, 0)+1
        if counts[path] == 1:
            return httpx.Response(503)
        if path.endswith('/util'):
            return httpx.Response(200, json=dict(timestamp=NOW.isoformat(), metrics=dict(fs_size_bytes=10000000000, fs_avail_bytes=8000000000, fs_used_bytes=2000000000)))
        return httpx.Response(200, text='# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} 10 1791936000000')
    result, requests = read(handler=handler)
    assert result['status'] == 'ok'
    assert len(requests) == 4


@pytest.mark.parametrize('timestamp', ['2026-10-14T00:00:00', 'secret', None, True])
def test_bad_disk_timestamp(timestamp):
    result, _ = read(disk=dict(timestamp=timestamp, metrics=dict(fs_size_bytes=10, fs_avail_bytes=8, fs_used_bytes=2)))
    assert result['errors'] == ['disk_timestamp_invalid']


def test_generated_wal_never_substituted():
    result, _ = read(metrics='# TYPE pg_wal_lsn_diff counter\npg_wal_lsn_diff 100\n')
    assert result['status'] != 'ok'
    assert result['resident_wal_bytes'] is None


def test_extra_series_labels_are_not_disclosed():
    result, _ = read(metrics='# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="replica",volume="data",secret="'+TOKEN+'"} 1 1791936000000')
    assert result['errors'] == ['wal_identity_unverified']
    assert TOKEN not in json.dumps(result)


def test_wal_cannot_exceed_used_space():
    result, _ = read(metrics='# TYPE pg_wal_size_mb gauge\npg_wal_size_mb{project="fdhspmavadgucktetzoi",instance="primary",volume="data"} 10000 1791936000000')
    assert result['errors'] == ['wal_exceeds_used']


def test_parser_line_limit():
    result, _ = read(metrics='# TYPE pg_wal_size_mb gauge\n'+'# ignored\n'*100001)
    assert result['errors'] == ['metrics_parser_limit']


def test_compressed_body_refused():
    result, _ = read(handler=lambda _: httpx.Response(200, headers={'content-encoding': 'identity-other'}, content=b'ignored'))
    assert result['status'] != 'ok'


def test_public_transport_config_and_no_contract_override(monkeypatch):
    import supabase_metrics.core as core
    original = httpx.AsyncClient
    requests = []
    def handler(request):
        requests.append(request)
        assert request.headers['authorization'] == 'Bearer '+TOKEN
        return httpx.Response(401, text=TOKEN)
    def client(**kwargs):
        assert kwargs['verify'] is True
        assert kwargs['trust_env'] is True
        # Fixture transport must never follow the execution host's real proxy.
        kwargs['trust_env'] = False
        assert kwargs['follow_redirects'] is False
        return original(**kwargs, transport=httpx.MockTransport(handler))
    monkeypatch.setenv('SUPABASE_METRICS_PAT', TOKEN)
    monkeypatch.setenv('SUPABASE_METRICS_URL', 'https://evil.example')
    monkeypatch.setenv('SUPABASE_METRICS_WAL_UNIT', '1048576')
    monkeypatch.setattr(core.httpx, 'AsyncClient', client)
    result = core.get_supabase_storage_metrics()
    assert len(requests) == 1
    assert requests[0].url.host == 'api.supabase.com'
    assert result['status'] == 'unavailable'
    assert TOKEN not in json.dumps(result)


def test_hard_deadline_cancels_pending_operation(monkeypatch):
    import supabase_metrics.core as core
    cancelled = []
    async def stalled(*args, **kwargs):
        try:
            await asyncio.sleep(60)
        finally:
            cancelled.append(True)
    original_timeout = asyncio.timeout
    def short_timeout(seconds):
        assert seconds == 20
        return original_timeout(0.01)
    monkeypatch.setattr(core, '_read_inner', stalled)
    monkeypatch.setattr(core.asyncio, 'timeout', short_timeout)
    result = asyncio.run(core._read(None, lambda: NOW))
    assert result['errors'] == ['deadline_exceeded']
    assert cancelled == [True]


def test_per_reading_receipt_times_and_unknown_measurement_age():
    from supabase_metrics.core import _read
    current = NOW + timedelta(seconds=120)
    disk = dict(timestamp=NOW.isoformat(), metrics=dict(fs_size_bytes=100, fs_avail_bytes=80, fs_used_bytes=20))
    def handler(request):
        nonlocal current
        current += timedelta(seconds=2)
        if request.url.path.endswith('/util'):
            return httpx.Response(200, json=disk)
        return httpx.Response(200, text='# TYPE pg_wal_size_mb gauge\npg_wal_size_mb 10\n')
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await _read(client, lambda: current)
    result = asyncio.run(run())
    assert result['disk_fetched_at'] == (NOW + timedelta(seconds=122)).isoformat()
    assert result['wal_fetched_at'] == (NOW + timedelta(seconds=124)).isoformat()
    assert result['disk_observed_at'] == NOW.isoformat()
    assert result['disk_reported_age_seconds'] == 124
    assert result['wal_observed_at'] is None
    assert result['wal_reported_age_seconds'] is None
    assert result['disk_measurement_age_status'] == 'unknown'
    assert result['wal_measurement_age_status'] == 'unknown'
    assert result['operationally_eligible'] is False
    assert result['errors'] == ['source_contract_unverified']


def test_failed_fetch_has_no_receipt_timestamp():
    result, _ = read(handler=lambda _: httpx.Response(403))
    assert result['disk_fetched_at'] is None
    assert result['wal_fetched_at'] is None
    assert result['disk_reported_age_seconds'] is None
    assert result['wal_reported_age_seconds'] is None
    assert result['disk_measurement_age_status'] == 'unknown'


def test_verified_fixture_age_does_not_hide_staleness():
    result, _ = read(now=NOW + timedelta(seconds=91))
    assert result['disk_reported_age_seconds'] == 91
    assert result['wal_reported_age_seconds'] == 91
    assert result['disk_measurement_age_status'] == 'verified'
    assert result['wal_measurement_age_status'] == 'verified'
    assert result['status'] == 'stale'
    assert result['operationally_eligible'] is False


def test_receipt_times_are_utc_with_offset_clock():
    clock = NOW.astimezone(timezone(timedelta(hours=2)))
    result, _ = read(now=clock)
    assert result['disk_fetched_at'] == NOW.isoformat()
    assert result['wal_fetched_at'] == NOW.isoformat()


def test_disk_receipt_and_age_survive_wal_fetch_failure():
    def handler(request):
        if request.url.path.endswith('/util'):
            return httpx.Response(200, json=dict(timestamp=NOW.isoformat(), metrics=dict(fs_size_bytes=100, fs_avail_bytes=80, fs_used_bytes=20)))
        return httpx.Response(403)
    result, _ = read(handler=handler, contract=False, now=NOW + timedelta(seconds=120))
    assert result['disk_fetched_at'] == (NOW + timedelta(seconds=120)).isoformat()
    assert result['disk_observed_at'] == NOW.isoformat()
    assert result['disk_reported_age_seconds'] == 120
    assert result['disk_measurement_age_status'] == 'unknown'
    assert result['wal_fetched_at'] is None
    assert result['wal_reported_age_seconds'] is None
    assert result['errors'] == ['http_rejected']
    assert result['operationally_eligible'] is False
