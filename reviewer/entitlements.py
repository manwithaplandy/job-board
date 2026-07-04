"""Single source of tier truth for the Python runtime (reviewer + worker).

MIRRORS dashboard/lib/entitlements.ts field-for-field; tests/test_entitlements_parity.py
regex-extracts the TS values and asserts equality with the constants here. Keep the
two in lockstep. Stdlib only (datetime) so the reviewer can import it anywhere.

Pricing: spec 2026-07-03 "Pricing & tiers".
"""
from datetime import datetime, timedelta, timezone

CHEAP_MODEL = "deepseek/deepseek-v4-flash"
PREMIUM_MODEL = "anthropic/claude-haiku-4.5"

# plan -> {stage2_models: {slot: per-day review cap}, monthly_resume, monthly_cover}
ENTITLEMENTS = {
    "standard": {"stage2_models": {"cheap": 400}, "monthly_resume": 30, "monthly_cover": 30},
    "pro": {"stage2_models": {"cheap": 1000, "premium": 100}, "monthly_resume": 100, "monthly_cover": 100},
}

# 3-day grace past current_period_end (webhook lag / renewal retry). Mirrors GRACE_MS.
_GRACE = timedelta(days=3)


def model_slot(model):
    """Entitlement slot for a concrete OpenRouter model id (None = neither)."""
    if model == PREMIUM_MODEL:
        return "premium"
    if model == CHEAP_MODEL:
        return "cheap"
    return None


def resolve_plan(sub, invited, now=None):
    """The user's effective plan under the chargeable-beta policy.

    sub: mapping with keys plan, status, current_period_end (a tz-aware datetime or
    None), or None when the user has no subscription row. invited: server-side
    invite proof. Returns 'standard' | 'pro' | None with semantics identical to
    resolvePlan in entitlements.ts:
      - active|trialing subscription within (current_period_end + 3-day grace) -> its plan
      - else invited (comped Phase-0 beta) -> 'standard'
      - else -> None
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if sub is not None:
        status = sub.get("status")
        plan = sub.get("plan")
        cpe = sub.get("current_period_end")
        if status in ("active", "trialing") and plan in ("standard", "pro") and cpe is not None:
            if cpe + _GRACE > now:
                return plan
    if invited:
        return "standard"
    return None


def resolve_stage2_model(plan, requested_model):
    """The entitled stage-2 model: the requested one if the plan grants its slot,
    else CHEAP_MODEL."""
    if plan:
        slot = model_slot(requested_model)
        if slot and ENTITLEMENTS[plan]["stage2_models"].get(slot) is not None:
            return requested_model
    return CHEAP_MODEL


def daily_review_cap(plan, model):
    """Per-user, per-day review cap for (plan, resolved stage-2 model). None -> 0."""
    if not plan:
        return 0
    caps = ENTITLEMENTS[plan]["stage2_models"]
    slot = model_slot(model) or "cheap"
    cap = caps.get(slot)
    if cap is None:
        cap = caps.get("cheap", 0)
    return cap


def monthly_allowance(plan, kind):
    """Monthly generation allowance for kind in ('resume','cover'). None -> 0."""
    if not plan:
        return 0
    ent = ENTITLEMENTS[plan]
    return ent["monthly_resume"] if kind == "resume" else ent["monthly_cover"]
