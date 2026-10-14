"""Fixed-project observation only. No database or campaign writes."""
from __future__ import annotations

import asyncio
import json
import math
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Literal, TypedDict

import httpx

PROJECT = 'fdhspmavadgucktetzoi'
PATHS = (f'/v1/projects/{PROJECT}/config/disk/util', f'/v1/projects/{PROJECT}/analytics/endpoints/metrics')
Status = Literal['ok', 'incomplete', 'stale', 'invalid', 'unavailable']


class MetricsResult(TypedDict):
    schema_version: int
    reader_version: str
    project_ref: str
    status: Status
    operationally_eligible: bool
    fetch_started_at: str
    fetch_finished_at: str
    source_paths: list[str]
    disk_observed_at: str | None
    wal_observed_at: str | None
    observed_at: str | None
    instance: str | None
    volume: str | None
    capacity_bytes: int | None
    available_bytes: int | None
    used_bytes: int | None
    resident_wal_bytes: int | None
    errors: list[str]


@dataclass(frozen=True)
class _Contract:
    """Reviewed source semantics, never caller/env configurable."""
    wal_bytes_per_unit: int
    labels: dict[str, str]
    instance: str
    volume: str


# Populate only after separately approved source verification and code review.
_VERIFIED_CONTRACT: _Contract | None = None


class _Failure(Exception):
    def __init__(self, code: str, status: Status = 'invalid'):
        self.code, self.status = code, status


def _utc():
    return datetime.now(timezone.utc)


def _empty(start: datetime) -> MetricsResult:
    return dict(schema_version=1, reader_version='1.0.0', project_ref=PROJECT,
                status='incomplete', operationally_eligible=False,
                fetch_started_at=start.isoformat(), fetch_finished_at=start.isoformat(),
                source_paths=list(PATHS), disk_observed_at=None, wal_observed_at=None,
                observed_at=None, instance=None, volume=None, capacity_bytes=None,
                available_bytes=None, used_bytes=None, resident_wal_bytes=None, errors=[])


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not 0 <= value <= 2**63-1:
        raise _Failure('disk_invalid')
    if int(value) != value:
        raise _Failure('disk_invalid')
    return int(value)


def _timestamp(value):
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None or stamp.utcoffset() is None:
            raise ValueError()
        return stamp.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError, OverflowError):
        raise _Failure('disk_timestamp_invalid') from None


async def _fetch(client, path, cap, deadline, monotonic, sleep, clock):
    for attempt in range(2):
        remaining = deadline-monotonic()
        if remaining <= 0:
            raise _Failure('deadline_exceeded', 'unavailable')
        retry = 0.25
        try:
            async with client.stream('GET', 'https://api.supabase.com'+path,
                               timeout=min(5, remaining), follow_redirects=False,
                               headers={'Accept-Encoding': 'identity'}) as response:
                if response.status_code == 200:
                    if response.headers.get('content-encoding', 'identity') != 'identity':
                        raise _Failure('encoding_unsupported')
                    body = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=16384):
                        if monotonic() >= deadline:
                            raise _Failure('deadline_exceeded', 'unavailable')
                        body.extend(chunk)
                        if len(body) > cap:
                            raise _Failure('response_too_large')
                    return bytes(body)
                if response.status_code != 429 and not 500 <= response.status_code <= 599:
                    raise _Failure('http_rejected', 'unavailable')
                header = response.headers.get('retry-after')
                if header:
                    try:
                        retry = float(header) if header.isdigit() else (parsedate_to_datetime(header)-clock()).total_seconds()
                        if not math.isfinite(retry):
                            raise ValueError()
                        retry = max(0, retry)
                    except (ValueError, TypeError, OverflowError):
                        raise _Failure('retry_after_invalid', 'unavailable') from None
        except httpx.HTTPError:
            pass
        if attempt == 1:
            raise _Failure('transport_unavailable', 'unavailable')
        if retry >= deadline-monotonic():
            raise _Failure('deadline_exceeded', 'unavailable')
        await sleep(retry)
    raise AssertionError('unreachable')


_LABEL = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)=("(?:[^"\\\n]|\\[\\"n])*")')
_SAMPLE = re.compile(r'pg_wal_size_mb(?:\{([^}]*)\})?\s+(\S+)(?:\s+(\S+))?\s*')


def _wal(body, contract):
    try:
        text = body.decode('utf-8')
    except UnicodeError:
        raise _Failure('metrics_encoding_invalid') from None
    lines = text.splitlines()
    if len(lines) > 100000 or any(len(line) > 16384 for line in lines):
        raise _Failure('metrics_parser_limit')
    kinds = [line for line in lines if line.startswith('# TYPE pg_wal_size_mb ')]
    samples = [line for line in lines if re.match(r'^pg_wal_size_mb(?:\{|\s|$)', line)]
    if kinds != ['# TYPE pg_wal_size_mb gauge']:
        raise _Failure('wal_type_invalid')
    if not samples:
        raise _Failure('wal_missing', 'incomplete')
    if len(samples) != 1:
        raise _Failure('wal_ambiguous')
    match = _SAMPLE.fullmatch(samples[0])
    if not match:
        raise _Failure('wal_invalid')
    label_text, value, stamp = match.groups()
    labels = {}
    rest = label_text or ''
    while rest:
        item = _LABEL.match(rest)
        if not item or item[1] in labels or len(labels) >= 16:
            raise _Failure('wal_labels_invalid')
        labels[item[1]] = json.loads(item[2])
        rest = rest[item.end():]
        if rest:
            if not rest.startswith(',') or len(rest) == 1:
                raise _Failure('wal_labels_invalid')
            rest = rest[1:]
    if contract is None:
        raise _Failure('source_contract_unverified', 'incomplete')
    if labels != contract.labels:
        raise _Failure('wal_identity_unverified', 'incomplete')
    if contract.wal_bytes_per_unit not in (1000000, 1048576):
        raise _Failure('wal_units_unverified', 'incomplete')
    try:
        number = float(value) * contract.wal_bytes_per_unit
        if not math.isfinite(number) or not 0 <= number <= 2**63-1 or int(number) != number:
            raise ValueError()
    except (ValueError, OverflowError):
        raise _Failure('wal_invalid') from None
    if stamp is None:
        raise _Failure('wal_timestamp_missing', 'incomplete')
    try:
        if not re.fullmatch(r'[0-9]{1,16}', stamp):
            raise ValueError()
        timestamp = datetime.fromtimestamp(int(stamp)/1000, timezone.utc)
    except (ValueError, OverflowError, OSError):
        raise _Failure('wal_timestamp_invalid') from None
    return int(number), timestamp


async def _read_inner(client, clock=_utc, *, contract=None, monotonic=time.monotonic, sleep=asyncio.sleep):
    result = _empty(clock())
    deadline = monotonic()+20
    try:
        disk_body = await _fetch(client, PATHS[0], 65536, deadline, monotonic, sleep, clock)
        try:
            disk = json.loads(disk_body)
            if not isinstance(disk, dict):
                raise ValueError()
            capacity, available, used = [_number(disk['metrics'][key]) for key in ('fs_size_bytes', 'fs_avail_bytes', 'fs_used_bytes')]
            disk_time = _timestamp(disk['timestamp'])
        except (ValueError, KeyError, TypeError, UnicodeError):
            raise _Failure('disk_payload_invalid') from None
        if capacity <= 0 or available > capacity or used > capacity:
            raise _Failure('disk_invalid')
        result.update(capacity_bytes=capacity, available_bytes=available, used_bytes=used, disk_observed_at=disk_time.isoformat())
        body = await _fetch(client, PATHS[1], 8*1024*1024, deadline, monotonic, sleep, clock)
        wal, wal_time = _wal(body, contract)
        if wal > capacity-available:
            raise _Failure('wal_exceeds_used')
        result.update(resident_wal_bytes=wal, wal_observed_at=wal_time.isoformat(), observed_at=min(disk_time, wal_time).isoformat(), instance=contract.instance, volume=contract.volume)
        end = clock()
        ages = [(end-stamp).total_seconds() for stamp in (disk_time, wal_time)]
        if min(ages) < -5:
            raise _Failure('source_timestamp_future')
        if max(ages) > 90:
            raise _Failure('source_stale', 'stale')
        if monotonic() >= deadline:
            raise _Failure('deadline_exceeded', 'unavailable')
        result.update(status='ok', operationally_eligible=True)
    except _Failure as error:
        result.update(status=error.status, errors=[error.code])
    except Exception:
        # Adapter boundary: never expose exception text, URLs, bodies or secrets.
        result.update(status='unavailable', errors=['reader_internal_error'])
    result['fetch_finished_at'] = clock().isoformat()
    return result


async def _get_supabase_storage_metrics() -> MetricsResult:
    """Read allowlisted storage observations; no arguments or writes."""
    token = os.environ.get('SUPABASE_METRICS_PAT', '')
    if not token or token.strip() != token or any(ord(c) < 33 or ord(c) > 126 for c in token):
        result = _empty(_utc())
        result.update(status='unavailable', errors=['credential_missing' if not token else 'credential_invalid'])
        return result
    try:
        async with httpx.AsyncClient(headers={'Authorization': 'Bearer '+token}, trust_env=False, verify=True, follow_redirects=False) as client:
            return await _read(client, contract=_VERIFIED_CONTRACT)
    except Exception:
        result = _empty(_utc())
        result.update(status='unavailable', errors=['reader_internal_error'])
        return result


async def _read(client, clock=_utc, **kwargs):
    start = clock()
    try:
        async with asyncio.timeout(20):
            return await _read_inner(client, clock, **kwargs)
    except TimeoutError:
        result = _empty(start)
        result.update(status='unavailable', errors=['deadline_exceeded'], fetch_finished_at=clock().isoformat())
        return result


def get_supabase_storage_metrics() -> MetricsResult:
    """Synchronous fixed-project API. Use CLI/MCP from async applications."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(_get_supabase_storage_metrics())
    result = _empty(_utc())
    result.update(status='unavailable', errors=['sync_context_required'])
    return result
