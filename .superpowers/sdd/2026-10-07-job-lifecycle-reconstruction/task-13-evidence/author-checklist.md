# Author integration checklist (not independent review)

- Existing reconcile_chunk and operational reconcile public booleans remain. Private typed tuples carry write counts to the scheduler; summary increments occur after commit, and already closed/replayed identities contribute zero. Existing source claims, HTTP implementation, reservation and operational receipt interfaces remain unchanged.
- New source child is independent and bounded, respects source_enabled before maintenance/poll, shares the existing due/fairness/operational scheduler, and closes its connection in finally. Supervisor owns at most one child of each kind and existing shared shutdown behavior. No new runtime service or credentials.
- Migration09 is additive and mirrored. The sole established control change replaces unconditional readiness placeholders with explicit prerequisites; existing history/monotonic/generation/rollback predicates remain. Readiness records are service-only; no automatic attestations or activation. Bounded mapping certification does not claim code compatibility; baseline completion read scans are documented. No changes to old role/claim/physical SQL mechanisms.
- Accepted Task10 clean-schema definitions lacked ledger rows05/06; the repair records those definitions only. Existing selected migration replay is the regression evidence.
- Existing terminal cleanup behavior was composed in an ordinary expired archive/replacement fixture. Old pending rows, replacement, compact marker and authorization history are retained. Archive-clock injection is confined to the accepted local test fixture.
- TS fixtures retain strict owned random-loopback checks. Default unit lane excludes DB files; owned allowlist is explicit/sequential. Fixture max:1 permits existing raw migration transactions; no assertion or target guard removed. Two inherited tombstone mocks now implement the current wrapper, preserving tombstone-before-write and exactly-one-live-write assertions.
- Billing helper and card extractions fix concrete Next route/page export errors only. Existing function/component bodies are unchanged. No pricing, premium/standard copy, subscription behavior, checkout action, model settings or props changed.

## Actual React checklist

Applied `vercel:react-best-practices` from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/react-best-practices/SKILL.md` to app/billing/page.tsx and components/billing/TierCard.tsx.

- Structure: TierCard is a top-level named component in its own module; page exposes only default/dynamic/metadata App Router exports. Direct imports; no barrel or heavy new dependency.
- Server/client: TierCard remains a server component; existing SubscribeButton remains the client boundary. No use-client widening or secret/request-state serialization introduced.
- Async/data: BillingPage retains existing parallel Promise.all subscription/plan/tier reads; extraction adds no fetch, waterfall, cache or mutable module state.
- Hooks/state: no new hooks, effects, state or subscriptions. Derived caps remain a small render calculation; no unjustified memoization.
- Accessibility/render: existing heading, plan identity/current badge, keyed feature list, price text and SubscribeButton semantics preserved exactly. No behavior/visual redesign.
- TypeScript: existing Plan/EntitlementMap and prices prop contract retained; no new any, boundary cast or JSON parser. Existing typed Object.entries assertion moved unchanged.
- Verification: existing two-case component test plus helper route mocks; final typecheck/lint/build phase. Actual RolefitBoard browser evidence covers lifecycle views, not an authenticated live billing interaction.

## Resource sampling boundaries

Four Popen children: (1) actual reviewer.worker.main/import with fake DB and process_one sleeping two seconds, no model/provider; (2) actual maintenance worker module; (3) actual archive export_once orchestration with FakeS3 injected (not reviewer.archive_worker module); (4) actual source_worker module with source disabled. Supervisor timing is separately exercised by deterministic tests; the supervisor process is NOT part of the RSS/CPU sample. Parent pytest/observer and PostgreSQL backend memory/CPU are excluded from RSS/CPU sums. DB session peak DOES include the fixture observer, and excludes the fake reviewer connection. Samples every20ms can miss brief peaks; CPU is the maximum observed sum of still-present child counters, not lifetime accumulated CPU after child exits. Wall time ends when the reviewer-ready marker and other three successful exits are observed. It is a finite offline startup/turn sample, not sustained all-flags-enabled runtime sizing or cost neutrality.

## Verified owned reset housekeeping

Current source ce256 adds only an optional isolated-harness ownership tuple and test reset helper. Existing-service child environment cannot inherit it. Helper validates live connection shape, exact immutable container ID/invocation label and matching random127.0.0.1 published port, then checkpoints only a committed clean reset in autocommit and restores mode. No environment/credential inspection, product SQL, guard/deadline override or synthetic size credit. Full current38117/16 both passed; old failures/slow phases and readonly file/wait observations retained. This ordinary positive invocation is not a new independent ownership/security mechanism review.
