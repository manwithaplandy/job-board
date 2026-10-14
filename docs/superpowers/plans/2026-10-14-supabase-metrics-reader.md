# Supabase Metrics Reader Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. The user approved implementation and independent review on 2026-10-14.

**Goal:** Provide a reusable fixed-project read-only metrics core, CLI and stdio MCP interface with discoverable agent documentation.

**Architecture:** One Python core owns the two allowlisted GET operations and sanitized typed output. Thin adapters share it; fixture injection belongs to internal interfaces only. No production wiring.

**Tech Stack:** Python 3.12, HTTPX, optional pinned official MCP SDK, pytest.

**Spec:** ../specs/2026-10-14-supabase-metrics-reader.md

## Global Constraints

- Fixed project fdhspmavadgucktetzoi and two reviewed Management API GET endpoints only.
- No live scrape, credential creation/configuration, SQL, raw log output, authorization renewal, hosting, deployment or MCP registration.
- No caller-controlled URL, project, metric selector or transport settings.
- Missing/unsafe/unknown provenance fails closed; source age maximum 90 seconds, total request deadline 20 seconds, two attempts per endpoint maximum.
- Never rewrite commits; draft PR and exact-head CI only.

## Review Focus

- Stale upstream data cannot become fresh by attaching fetch time.
- WAL MB/MiB ambiguity and replica labels cannot silently become valid primary bytes.
- Transport errors and malformed payloads must not expose secret-bearing text.
- Retries, streaming response bodies and redirects must obey limits.
- MCP protocol must remain usable without accidentally registering a hosted tool or leaking CLI text to stdout.

## Task 1: Reader and adapters

Files: supabase_metrics/, tests/test_supabase_metrics*, pyproject.toml.
Interfaces: public get_supabase_storage_metrics() takes no arguments; CLI python -m supabase_metrics; MCP python -m supabase_metrics.mcp_server, stdio only.

- [ ] Add failing fixture tests for fixed requests, normalization, unsafe/stale data, unknown source semantics, transport limits and redaction.
- [ ] Run focused tests and record expected failure before implementation.
- [ ] Implement core and adapters, optional pinned MCP dependency, no production credentials.
- [ ] Run focused tests including real stdio MCP initialize/list/call and lint.
- [ ] Commit forward.

## Task 2: Agent guide and verification

Files: docs/supabase-metrics-reader.md, AGENTS.md, .github/workflows/ci.yml.

- [ ] Document setup, permission boundaries, fixture and real invocation, output examples, stop behavior and troubleshooting; link from AGENTS.md.
- [ ] Add CI job for focused metrics tests with optional MCP dependency, without expanding excluded acceptance suites.
- [ ] Independently review complete diff; fix important findings with regressions.
- [ ] Publish draft PR and verify all exact-head CI jobs; report remaining setup prerequisites honestly.
