# Supabase metrics reader for agents

This tool reads storage observations for job-board's Supabase project `fdhspmavadgucktetzoi`. It cannot run SQL, change settings, apply migrations, start a campaign, or renew campaign authorization. It is separate from the production workers.

## Start here

1. Read this guide before invoking the reader. Development and CI use synthetic fixtures only.
2. Check whether secure metrics access has been explicitly approved for this session. Installation alone does not authorize a live scrape or credential use.
3. Use the CLI in an available execution environment, or the stdio MCP adapter in a client that has explicitly registered it. These are supported invocation paths, not an automatically installed ChatGPT connector.
4. Stop on any result other than `ok`. Never replace missing WAL with zero, attach a new timestamp to stale data, or write authorization based on an incomplete result.

The initial release intentionally has no verified upstream semantics contract. Even with an approved valid token, data remains ineligible for operational gating until a separately reviewed change records verified WAL conversion, primary identity, volume mapping and source-freshness semantics. There is no CLI/environment switch to bypass this gate.

## Installation and offline verification

Use Python 3.12 or later. From the repository root, create an isolated environment:

```sh
python3.12 -m venv .venv-metrics
.venv-metrics/bin/python -m pip install -e '.[metrics-mcp,dev]'
.venv-metrics/bin/python -m pytest tests/test_supabase_metrics*.py -q
```

The optional `metrics-mcp` extra is needed only for MCP. Core/CLI use the existing HTTPX dependency. The adapter uses official `mcp==1.26.0`. Follow the committed dependency pin; do not silently upgrade the MCP SDK. Tests inject synthetic transports and clocks and never require a PAT or a production database. The CI metrics job is the authoritative list of adapter tests. Do not run broad lifecycle test discovery: use the repository's permitted acceptance runner for that separate suite.

## Permission and credential handling

The proposed access is a dedicated short-lived fine-grained Supabase PAT scoped only to `fdhspmavadgucktetzoi`, with:

| Permission | Allowed tool operation |
| --- | --- |
| Disk Config Read (`infra_disk_config_read`) | GET `/v1/projects/fdhspmavadgucktetzoi/config/disk/util` |
| Logs Read (`analytics_logs_read`) | GET `/v1/projects/fdhspmavadgucktetzoi/analytics/endpoints/metrics` |

Logs Read is broader at Supabase than this tool: it also grants upstream log access. The reader's allowlist prevents it from calling those log routes. It does not turn the PAT itself into a metrics-only credential. No database, migration, write, API-key-read, service-role or secret-key access is needed.

After separate access approval, an owner creates the token in Supabase and installs it using the execution platform's secure secret control under `SUPABASE_METRICS_PAT`. Never request or paste secrets in chat, put them in a shell command, commit an environment file, print the environment, or include credentials in issue/PR evidence. Do not reuse existing dashboard or worker secrets. Set an appropriate expiry, track the owner and revoke when no longer needed. Token rotation and persistent secret storage require their own setup approval.

## CLI

After approved secure environment injection:

```sh
.venv-metrics/bin/python -m supabase_metrics
```

The command takes no project, URL, SQL, metric, token, timeout or freshness arguments. Output is one sanitized JSON object. Exit 0 means `ok`; exit 1 means observations are not eligible; exit 2 indicates an adapter/setup problem. Do not treat successful HTTP requests as a successful observation.

Without a configured credential, the same command provides a safe setup check and performs no upstream request. Use fixture tests for a complete successful example; do not fabricate an example as production evidence.

## MCP stdio adapter

```sh
.venv-metrics/bin/python -m supabase_metrics.mcp_server
```

This starts a local stdio MCP server. It exposes exactly `get_supabase_storage_metrics` with no input arguments. The client uses stdin/stdout for the protocol; do not manually type secrets into either stream. Register the command and absolute working directory/interpreter path in the specific MCP client's supported configuration, with the secret supplied through that client's approved secret mechanism. No example embeds a PAT in JSON configuration.

The tool is read-only and returns the same structured result as the CLI. A client must initialize the server and discover its tools before invocation. Starting this process does not register it with ChatGPT, a saved cloud task, or the parent assistant. Those environments may lack local process support or this filesystem. Remote MCP hosting, client authentication, registration and costs are separate work and are not implemented or approved here. The adapter has no public HTTP listener.

## Reading the result

The result carries a schema version, fixed project, reader version, fetch interval, allowlisted source paths, source timestamps, storage byte values and a fixed status/error code. Missing measurements remain null. Raw Prometheus text, unknown labels, response bodies, headers and exception text are never returned.

Stop-decision excerpts from the typed result (timestamps and other fields omitted here):

```json
{"status":"incomplete","operationally_eligible":false,"errors":["source_contract_unverified"]}
```

```json
{"status":"unavailable","operationally_eligible":false,"errors":["credential_missing"]}
```

These excerpts illustrate stop decisions, not observed production readings. The tests contain complete synthetic payloads and expected adapter results. The full result includes `schema_version`, `reader_version`, `project_ref`, `status`, `operationally_eligible`, `fetch_started_at`, `fetch_finished_at`, `source_paths`, `disk_observed_at`, `wal_observed_at`, `observed_at`, `instance`, `volume`, `capacity_bytes`, `available_bytes`, `used_bytes`, `resident_wal_bytes`, and `errors`. Only `status=ok` together with `operationally_eligible=true` is eligible evidence.

Disk utilization returns a timestamp and `fs_size_bytes`, `fs_avail_bytes`, `fs_used_bytes`. Available space can differ from capacity minus used because of reserved blocks; do not force equality. The required WAL series is `pg_wal_size_mb`, a gauge of disk space used by WAL files. WAL generation counters or rates are not resident WAL. The name `_mb` alone does not prove decimal MB versus binary MiB. Before setting any conversion, inspect the upstream exporter/query definition and verify a real approved sample. Duplicate, unknown or replica-only series do not establish primary storage usage.

Fetch start/end describe the HTTP operation. Source observation timestamps describe the metrics. A current fetch timestamp cannot repair old or unknown source time. Observations must be no older than 90 seconds at return, with separate source timestamps preserved and the older one controlling combined age. No stale cached result can be treated as healthy.

The result does not grant permission to migrate or run a campaign. A separately authorized writer must enforce its own provenance, thresholds and commit-time expiry. Never send this reader a database credential or add a renewal side effect to make a campaign proceed.

## Failure and troubleshooting

| Condition | Agent action |
| --- | --- |
| Missing credential | Stop; request secure access setup only if the user wants a live read. Never ask for the token in chat. |
| HTTP 401/403 | Stop; check expiry/project scope/approved permissions via owner. No broader token or secret fallback. |
| HTTP 429, transient 5xx, network timeout | Reader retries within bounded limits; if still unavailable, stop and try a later explicitly needed read. |
| Redirect, oversized body, malformed data | Stop; report the fixed error code. Do not dump raw payloads. |
| Missing WAL, unknown units/labels/timestamps | Incomplete; obtain approved source evidence and a reviewed contract change. Never guess or lower freshness requirements. |
| Stale/future/invalid numeric readings | Stop; investigate upstream observation semantics and clock health. |
| MCP import/setup failure | Install the committed optional extra in the selected environment; confirm client interpreter/working directory. |
| MCP tool unavailable in assistant | Register through the actual supported client workflow after approval; do not claim it is already callable. |

Transport is restricted to HTTPS GET on `api.supabase.com`, redirects disabled, two attempts per endpoint maximum, a 20-second operation budget, and bounded response sizes. Only sanitized fixed errors escape the reader. No background polling or persistent metric storage is included.

## First approved integration session

Verify the PAT scope and expiry through a secure administrative control; then perform the bounded read. Confirm primary identity, actual metric presence, exact units, disk-volume mapping and trustworthy upstream sample age. Record only sanitized results and nonsecret source evidence. Have the contract update reviewed and run fixtures/CI before accepting `ok` as evidence. Do not register a new server, configure persistent access, deploy infrastructure or renew a campaign as part of this read.

## References

- [Disk utilization endpoint](https://supabase.com/docs/reference/api/v1-get-disk-utilization)
- [Metrics scrape endpoint](https://supabase.com/docs/reference/api/v1-scrape-project-metrics)
- [Fine-grained PAT permissions](https://supabase.com/docs/guides/platform/personal-access-tokens)
- [Official metrics list](https://github.com/supabase/supabase-grafana/blob/main/metrics.md)
- [Approved design](superpowers/specs/2026-10-14-supabase-metrics-reader.md)
