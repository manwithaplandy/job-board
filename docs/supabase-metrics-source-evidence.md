# Supabase metrics source verification — 2026-10-14

## Outcome

Secure read access works. No production-safe source contract has been established.
Keep `_VERIFIED_CONTRACT=None` and `operationally_eligible=false`. This document
records observations, not campaign authorization or permission for more access.
No runtime code or fixtures were changed to make incomplete data eligible.

## Bounded live observations

All requests used the two existing fixed-project endpoints at reader head
`ca5e227a87d3c48a107e27297c76a61449cb9be3`. Both returned successfully. The first
CLI fetch ran 04:59:21.237–04:59:22.847 UTC. Three additional authorized diagnostic
pairs finished at 05:01:41.269, 05:02:25.429 and 05:03:36.758 UTC. No other Supabase
endpoint or SQL was accessed. No background polling was started.

| Disk field | Reported bytes |
| --- | ---: |
| `fs_size_bytes` | 12,643,950,592 |
| `fs_avail_bytes` | 7,621,169,152 |
| `fs_used_bytes` | 5,022,781,440 |

Every disk response reported `2026-10-14T04:59:21Z`. Its reported age at the first
CLI return was 1.847 seconds; by the final diagnostic return it was 255.758
seconds, exceeding the 90-second policy. The public API schema calls the field
`timestamp` but does not define its provenance. Thus even the initially recent
value is a **reported timestamp**, not independently proven measurement time.
The endpoint's stale timestamp must not be replaced with local collection time.

All three diagnostic scrapes had one `pg_wal_size_mb` gauge with numeric value
`1024.000352859497` and **no explicit Prometheus sample timestamp**. This is a
resident-WAL gauge by the official metric description; it is not a generated-WAL
counter or rate. Exact byte conversion remains unverified, so this value is not
published as resident bytes or accepted operational evidence.

Allowlisted comparisons confirmed that both `supabase_project_ref` and
`supabase_identifier` equaled the fixed project. WAL labels exactly matched that
pair plus `service_type="postgresql"` and `server="localhost:5432"`. These observed
labels identify the returned series; they do not by themselves prove primary role
or the current deployment's exporter-query definition.

Filesystem series identified `/data` with the same 12,643,950,592-byte capacity;
`/` had a different 10,359,754,752-byte capacity. At the final read, `/data`
available bytes also equaled the disk endpoint. Earlier filesystem available
bytes differed from that endpoint. This corroborates a `/data` mapping but is not
a documented API guarantee or proof of synchronized measurements. The filesystem
series also lacked explicit sample timestamps.

`pg_up=1` and `pg_exporter_last_scrape_error=0` were present. Scrape duration and
filesystem values changed between the second and third diagnostics, demonstrating
some upstream refresh, but neither a success flag nor a changed value bounds the
age of the WAL measurement. `node_time_seconds` was not present in these diagnostic
samples. Exporter start/GC times and HTTP receipt dates would not establish the
WAL query's measurement time either.

## Official source evidence and limits

- [Management API disk schema](https://supabase.com/docs/reference/api/v1-get-disk-utilization)
  documents the three byte fields and `timestamp`; it gives no timestamp-origin,
  maximum-age or primary-volume guarantee.
- [Management API metrics route](https://supabase.com/docs/reference/api/v1-scrape-project-metrics)
  documents Prometheus output and the `analytics_logs_read` permission. It does
  not provide a collection-to-measurement freshness bound.
- [Supabase's metric inventory, pinned](https://github.com/supabase/supabase-grafana/blob/959b30e15ab5b7dd29fab55f8d073e48fa90df24/metrics.md#L517)
  describes `pg_wal_size_mb` as a WAL disk-space gauge and shows the observed
  project/identifier/service/server label shape without a sample timestamp.
  It does not specify decimal MB versus binary MiB.
- [Supabase's metrics announcement](https://supabase.com/blog/metrics-api-observability)
  describes a one-minute refresh cadence for the project Metrics API. That is
  not a maximum stale-response guarantee for this Management API route, nor
  evidence about failure/cache behavior. It cannot justify a 90-second gate.
- [Current public exporter service configuration, pinned](https://github.com/supabase/postgres/blob/f4c005d50608990033ab370f9b00fd1c693c99db/ansible/files/postgres_exporter.service.j2#L9)
  references `/opt/postgres_exporter/queries.yml`. The corresponding query file
  is not present in that public source tree. The upstream installation task
  installs the exporter but does not provide the managed live query definition.
- [Historical public queries](https://github.com/supabase/postgres/blob/15.1.0.147/docker/all-in-one/opt/postgres_exporter/queries.yml)
  use division by `1024 * 1024` and a 60-second cache for a **different** database
  size metric incorporating WAL. That is evidence of historical MiB usage, not
  proof of the current `pg_wal_size_mb` query or its cache age.
- [Current public PostgreSQL filesystem policy, pinned](https://github.com/supabase/postgres/blob/f4c005d50608990033ab370f9b00fd1c693c99db/ansible/files/postgresql_config/sbpostgres_apparmor#L27)
  permits WAL under `/data/pgdata/pg_wal`. This supports the expected layout but
  does not prove this project's live deployment or Management API volume mapping.

## Minimal source-contract proposal

Do not fill in the existing all-or-nothing `_Contract` from these observations.
There is insufficient evidence for an operationally eligible implementation.
The smallest feasible next step is to obtain authoritative documentation or
owner-provided Supabase support evidence for the **deployed** query and route:

1. The exact resident-WAL query, its divisor, precision/rounding and query-cache
   behavior; how the response identifies that exporter/query version.
2. A primary-role invariant for the observed identifier and a documented mapping
   from the disk-util route to that primary's WAL-containing filesystem.
3. A trustworthy measurement timestamp per source, or a documented worst-case
   measurement-age bound covering query caching, exporter collection, API caching,
   retries and failures. A refresh interval alone is insufficient.

Such evidence can be supplied without expanding this reader's production access.
Do not contact support, request wider token permissions, add SQL, change endpoints,
refresh campaign authorization or alter the environment without the relevant
separate authorization. No request for broader access is required just to keep
this reader safely incomplete.

Once evidence exists, a reviewed contract change should use the real exact label
schema, verified byte conversion and conservative measurement-age representation,
with fixtures for the real shape, missing timestamps, stale cache, role/volume
mismatch and duplicate series. Never synthesize `wal_observed_at` from fetch time.
The current strict integer conversion must also be checked against exporter float
serialization/rounding before enabling it. An observation-only schema could later
expose the gauge's unconverted value and explicit uncertainty, but that is not an
operational contract and is not implemented here.
