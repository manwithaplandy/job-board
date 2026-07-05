-- Monotonic subscription upsert ordering (go-public SaaS, review finding M-WEBHOOK-ORDER).
--
-- THREAT: Stripe does NOT guarantee webhook delivery order. The subscription mirror's
-- upsert (dashboard/lib/subscriptions.ts) applied `status` unconditionally, so a
-- customer.subscription.updated event that was GENERATED before a cancellation but
-- DELIVERED after the customer.subscription.deleted would overwrite status='canceled'
-- back to 'active' — handing a canceled (unpaid) account live access until the next
-- authoritative event, if any, arrived.
--
-- FIX: record the Stripe EVENT timestamp (event.created) on the row as last_event_at,
-- and gate the ON CONFLICT DO UPDATE so an incoming event only wins when its timestamp
-- is >= the last one applied. A stale (older) event is then a no-op. `>=` (not `>`) so a
-- duplicate re-delivery of the same event is still idempotently applied.
--
-- SAME-SECOND TIE-BREAK: event.created has 1-SECOND resolution, so a stale updated event
-- generated in the SAME second as the cancel (and retried after the deleted) carries an
-- EQUAL watermark; `>=` alone would re-apply it and flip canceled→active. The upsert's
-- WHERE therefore also blocks the update when the stored row is already 'canceled', the
-- incoming event is NOT a cancel, and the watermarks are exactly equal (a canceled Stripe
-- subscription id is terminal — a genuine resubscribe is a NEW id with strictly-later
-- created). This lives in application SQL (dashboard/lib/subscriptions.ts), not this
-- migration; the migration only adds the watermark column.
--
-- The column is nullable (no default): legacy rows written before this migration have
-- last_event_at IS NULL, and the app's guard treats NULL as "accept" (COALESCE to epoch)
-- so the first post-migration event always lands and seeds the watermark.
--
-- House conventions: BEGIN/COMMIT, ADD COLUMN IF NOT EXISTS idempotency, recorded in
-- schema_migrations. schema.sql mirrors it. Clean twice on a scratch DB.
--
-- No remote apply from here (remote DBs are never touched from CI/local); apply to the
-- live Supabase project as the usual manual pre-deploy step.

BEGIN;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

COMMENT ON COLUMN subscriptions.last_event_at IS
  'Stripe event.created of the last webhook event applied to this row; the monotonic '
  'watermark that lets upsertSubscription drop stale out-of-order deliveries (M-WEBHOOK-ORDER).';

INSERT INTO schema_migrations (filename) VALUES ('2026-07-04-subscription-event-ordering.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
