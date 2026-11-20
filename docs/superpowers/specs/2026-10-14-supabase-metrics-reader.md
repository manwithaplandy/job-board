# Supabase metrics reader — proposed design

Status: design for approval, 2026-10-14. No credential, service, live scrape, or campaign authorization has been created.

## Recommendation

Build one small Python read-only library with a JSON CLI first, plus a thin MCP adapter over the same function. The CLI is callable through this workspace's execution tool when an approved token is injected securely. A saved cloud task does not automatically inherit this filesystem or executable; do not promise that route. A durable assistant-callable connector needs a separately approved authenticated remote MCP deployment and registration in the user's actual client. No currently exposed connector provides these two metrics operations. Shipping an MCP server alone does not make it available in ChatGPT.

First version: `get_supabase_storage_metrics()` with no caller-controlled parameters. Fixed project `fdhspmavadgucktetzoi`, fixed HTTPS host `api.supabase.com`, and only two GET paths:

- `/v1/projects/fdhspmavadgucktetzoi/config/disk/util`
- `/v1/projects/fdhspmavadgucktetzoi/analytics/endpoints/metrics`

No arbitrary URL, project, SQL, HTTP method, headers, metric expression, filesystem path, or raw-response mode. Future projects require reviewed configuration changes.

## Access and secure setup

Use a dedicated short-lived fine-grained PAT scoped to this project, with only Disk Config Read (`infra_disk_config_read`) and Logs Read (`analytics_logs_read`). Logs Read also permits log endpoints at the upstream API: this is the narrowest documented permission for the metrics route, not a metrics-only credential. The wrapper never exposes or calls log routes. For stronger separation, keep this credential solely in a dedicated authenticated MCP service, giving the assistant access only to its single sanitized operation.

After explicit access approval, the owner creates the token in Supabase and installs it through the chosen runner/service's secure secret interface. Never paste it in chat, shell arguments, repository files, artifacts, or logs. No service-role key, database password, SQL permissions, migration permissions, write scopes, or API-key-read permission is needed. Use an expiry suitable for a bounded verification session and revoke after use; persistent rotation/ownership is a separate approval.

## Typed result and validity

Return schema version, fixed project, reader version, fetch start/end UTC, source paths, per-source timestamps, primary instance/volume identity, capacity/available/used bytes, resident WAL bytes, and a status enum (`ok`, `incomplete`, `stale`, `invalid`, `unavailable`). Missing values are null, never zero. Return only allowlisted normalized fields and fixed error codes. Never include tokens, raw headers/bodies, log text, arbitrary metric labels, URLs from errors, or stack traces.

Disk readings use the API timestamp and byte fields. WAL must come from the `pg_wal_size_mb` gauge: generated-WAL counters are not a substitute. The approved first live scrape must verify actual presence, primary-project/instance labels, gauge type, and source conversion units before enabling a bytes conversion. The `_mb` name alone does not establish decimal versus binary units. Reject duplicate/ambiguous series and unknown primary/volume identity. Do not sum replicas or filesystem mounts.

Validate finite nonnegative numeric values, positive capacity, available <= capacity, used <= capacity, WAL <= capacity-available, valid timezone-aware timestamps, no future timestamps beyond a small documented clock tolerance, and source observations no older than 90 seconds at return. Do not require used+available=capacity because reserved filesystem blocks may differ. Preserve separate timestamps and use their minimum for combined age. Fetch time alone does not prove upstream freshness: absent trustworthy sample time or a verified endpoint freshness contract, return incomplete and ineligible for operational gating. No stale-cache fallback as healthy.

This result is observational only. It never writes campaign authorization, starts work, changes flags, runs migrations, or renews leases. A separately approved writer must independently enforce its thresholds, provenance and expiry. Current campaign guards accept a `supabase_metrics` observation; do not mark an unverified Management API result eligible merely to satisfy that label.

## Transport and resource limits

TLS validation on; redirects disabled. GET only. At most two attempts per endpoint for transient network failures, HTTP 429 or 5xx; respect Retry-After only within a 20-second total operation deadline, otherwise return unavailable. No retries for 401/403 or invalid payloads. Cap response bytes (initial proposal 8 MiB metrics, 64 KiB disk), parser series/label counts and numeric magnitude. No raw response logging or disk persistence. Sanitize errors before emitting JSON. Server-side rate limit and single-flight requests if remotely hosted; no background polling by default.

## Tests and release gates

Use offline fixed fixtures and an injected HTTP transport to verify exact requests, typed normalization, timestamps, units, duplicate/unknown labels, missing WAL, bad numeric values, 401/403, timeouts, retry budgets, body caps, redirect rejection and secret redaction. This is component validation, not an external security scan. No production calls while developing. First approved read-only integration session verifies source semantics, permissions and no secret output before claiming production readiness.

## Hosting, cost and approval boundaries

CLI-only development has no new hosting cost and is the smallest reproducible implementation. It requires a suitable execution environment and approved secure secret injection each session. Remote MCP adds an HTTPS service, caller authentication, secret storage, access logs containing only sanitized request metadata, token rotation and maintenance. Existing hosting could potentially run it, but entitlement, incremental cost and supported client registration are not yet verified; no claim of free hosting or saved-task compatibility. Do not put it into the reviewer worker or public dashboard API simply to reuse credentials.

Approve the interface and offline implementation first. Separately choose CLI session use or authenticated remote MCP, approve the two PAT scopes (including upstream log access), and provide the credential via a secure platform control. Then approve deployment/registration if remote access is wanted. No campaign renewal is implied by any metrics-reader approval.

## Sources

- https://supabase.com/docs/reference/api/v1-get-disk-utilization
- https://supabase.com/docs/reference/api/v1-scrape-project-metrics
- https://supabase.com/docs/guides/platform/personal-access-tokens
- https://github.com/supabase/supabase-grafana/blob/main/metrics.md
