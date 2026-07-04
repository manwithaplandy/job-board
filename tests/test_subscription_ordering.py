"""Real-Postgres parity test for the subscription-mirror upsert (M-WEBHOOK-ORDER).

The upsert SQL lives in TypeScript (dashboard/lib/subscriptions.ts). The mock vitest
test asserts the SQL *text* carries the guard; this test proves the *semantics* against
a real Postgres running schema.sql — that a stale/out-of-order Stripe event can never
re-grant a canceled plan, including the same-second (equal event.created) tie that a
plain `>=` watermark would let through.

The UPSERT below MUST stay byte-identical to upsertSubscription's ON CONFLICT clause;
if you change one, change both (the mock test guards the TS side).
"""

import datetime
import uuid

import pytest
from tests.conftest import requires_db

# Mirror of upsertSubscription (dashboard/lib/subscriptions.ts). Params:
#   %(user_id)s %(customer)s %(sub_id)s %(plan)s %(status)s
#   %(period_end)s %(cancel)s %(event_at)s
UPSERT_SQL = """
INSERT INTO subscriptions (
  user_id, stripe_customer_id, stripe_subscription_id, plan, status,
  current_period_end, cancel_at_period_end, last_event_at, updated_at
) VALUES (
  %(user_id)s::uuid, %(customer)s, %(sub_id)s, %(plan)s, %(status)s,
  %(period_end)s, %(cancel)s, %(event_at)s, now()
)
ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
  stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
  plan                   = EXCLUDED.plan,
  status                 = EXCLUDED.status,
  current_period_end     = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
  cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
  last_event_at          = EXCLUDED.last_event_at,
  updated_at             = now()
WHERE EXCLUDED.last_event_at
    >= COALESCE(subscriptions.last_event_at, '-infinity'::timestamptz)
  AND NOT (
    subscriptions.status = 'canceled'
    AND EXCLUDED.status <> 'canceled'
    AND EXCLUDED.last_event_at = subscriptions.last_event_at
  )
"""

T = datetime.datetime(2026, 7, 4, 12, 0, 0, tzinfo=datetime.timezone.utc)
T_NEXT = T + datetime.timedelta(seconds=1)  # strictly-later event.created
T_LATER = T + datetime.timedelta(hours=1)  # strictly-later, hours apart


def _upsert(conn, user_id, *, status, event_at, sub_id="sub_123", plan="pro"):
    with conn.cursor() as cur:
        cur.execute(
            UPSERT_SQL,
            {
                "user_id": str(user_id),
                "customer": "cus_123",
                "sub_id": sub_id,
                "plan": plan,
                "status": status,
                "period_end": T_LATER,
                "cancel": status == "canceled",
                "event_at": event_at,
            },
        )
    conn.commit()


def _status(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT status FROM subscriptions WHERE user_id = %s", (str(user_id),)
        )
        return cur.fetchone()["status"]


def _plan(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT plan FROM subscriptions WHERE user_id = %s", (str(user_id),))
        return cur.fetchone()["plan"]


@requires_db
def test_same_second_stale_update_cannot_reactivate_canceled(conn):
    """ATTACK: deleted (canceled, T) lands, then a stale updated (active) generated in
    the SAME second (event.created == T, first delivery failed, retried after the
    delete) arrives. The equal-watermark tie must NOT flip canceled→active."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="canceled", event_at=T)
    _upsert(conn, uid, status="active", event_at=T)  # stale, same-second
    assert _status(conn, uid) == "canceled"


@requires_db
def test_strictly_older_stale_update_cannot_reactivate_canceled(conn):
    """A strictly-older stale updated (event.created < the cancel's) is dropped by the
    base `>=` watermark."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="canceled", event_at=T_NEXT)
    _upsert(conn, uid, status="active", event_at=T)  # older
    assert _status(conn, uid) == "canceled"


@requires_db
def test_in_order_same_second_cancel_still_lands(conn):
    """DIRECTIONALITY: updated (active, T) then deleted (canceled, T) at the same
    second — the cancel is NOT a stale-reactivation, so the tie-break must let it
    through (this is why `>` is wrong: it would drop this legitimate cancel)."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="active", event_at=T)
    _upsert(conn, uid, status="canceled", event_at=T)
    assert _status(conn, uid) == "canceled"


@requires_db
def test_duplicate_cancel_redelivery_is_idempotent(conn):
    """A re-delivered duplicate cancel (same status, same watermark) stays canceled."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="canceled", event_at=T)
    _upsert(conn, uid, status="canceled", event_at=T)
    assert _status(conn, uid) == "canceled"


@requires_db
def test_unknown_price_nulls_the_plan_verbatim(conn):
    """PLAN IS AUTHORITATIVE, NOT COALESCED (upsertSubscription): a plan switch to a
    price we don't sell arrives with plan=NULL, and a fresher event must take
    EXCLUDED.plan VERBATIM so the stored plan becomes NULL (user gated). COALESCE-ing it
    back to the stored plan would leave the user entitled to Pro after switching to an
    unrecognized price — this guards that the parity SQL uses `plan = EXCLUDED.plan`."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="active", event_at=T, plan="pro")
    assert _plan(conn, uid) == "pro"
    # A strictly-later event on a price outside our catalog → plan NULL.
    _upsert(conn, uid, status="active", event_at=T_NEXT, plan=None)
    assert _plan(conn, uid) is None


@requires_db
def test_genuine_resubscribe_with_later_event_reactivates(conn):
    """A real resubscribe is a NEW Stripe subscription id whose event carries a
    strictly-later event.created — it must apply and re-grant access."""
    uid = uuid.uuid4()
    _upsert(conn, uid, status="canceled", event_at=T, sub_id="sub_old")
    _upsert(conn, uid, status="active", event_at=T_LATER, sub_id="sub_new")
    assert _status(conn, uid) == "active"
    with conn.cursor() as cur:
        cur.execute(
            "SELECT stripe_subscription_id FROM subscriptions WHERE user_id = %s",
            (str(uid),),
        )
        assert cur.fetchone()["stripe_subscription_id"] == "sub_new"
