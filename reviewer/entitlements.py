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

# Mirrors TRIAL_GRANTS_FULL_PLAN in entitlements.ts. Trials are not configured today
# (no Stripe trial_period_days); a `trialing` subscription entitles at most to Standard
# so a zero-cost trial can never unlock Pro's premium-model daily budget. Flip to True
# only when a paid-trial product deliberately grants full-plan access during the trial.
_TRIAL_GRANTS_FULL_PLAN = False


def _pos_int(v):
    """A positive int (caps/allowances) or None. Rejects bool, float, str, <=0.

    bool is an int subclass in Python, so exclude it explicitly.
    """
    if isinstance(v, bool) or not isinstance(v, int) or v <= 0:
        return None
    return v


def overlay_entitlements(rows):
    """Overlay DB tier_settings onto the compiled ENTITLEMENTS, field-by-field (T1).

    `rows` is an iterable of mappings {plan, config} where config is the jsonb value
    (a dict, or anything for a malformed row). Mirrors dashboard/lib/tierConfig.ts:
    every bad/absent field keeps the compiled default; never raises. A DB row may only
    override slots the compiled default already grants (it cannot invent a premium slot
    for Standard). Returns a fresh entitlements map (the compiled one is never mutated).
    """
    out = {plan: {"stage2_models": dict(ENTITLEMENTS[plan]["stage2_models"]),
                  "monthly_resume": ENTITLEMENTS[plan]["monthly_resume"],
                  "monthly_cover": ENTITLEMENTS[plan]["monthly_cover"]}
           for plan in ENTITLEMENTS}
    by_plan = {}
    for r in rows or []:
        try:
            by_plan[r["plan"]] = r["config"]
        except (KeyError, TypeError):
            continue
    for plan in out:
        cfg = by_plan.get(plan)
        if not isinstance(cfg, dict):
            continue
        s2 = cfg.get("stage2Models")
        if isinstance(s2, dict):
            for slot in list(out[plan]["stage2_models"].keys()):
                if slot in s2:
                    cap = _pos_int(s2[slot])
                    if cap is not None:
                        out[plan]["stage2_models"][slot] = cap
        if "monthlyResume" in cfg:
            n = _pos_int(cfg["monthlyResume"])
            if n is not None:
                out[plan]["monthly_resume"] = n
        if "monthlyCover" in cfg:
            n = _pos_int(cfg["monthlyCover"])
            if n is not None:
                out[plan]["monthly_cover"] = n
    return out


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
                # Clamp a trialing subscription below Pro (see _TRIAL_GRANTS_FULL_PLAN):
                # an unpaid trial entitles at most to Standard, never the premium budget.
                if status == "trialing" and not _TRIAL_GRANTS_FULL_PLAN and plan == "pro":
                    return "standard"
                return plan
    if invited:
        return "standard"
    return None


def resolve_stage2_model(plan, requested_model, ent=None):
    """The entitled stage-2 model: the requested one if the plan grants its slot,
    else CHEAP_MODEL. `ent` overrides the compiled ENTITLEMENTS map (T1 overlay)."""
    ent = ent if ent is not None else ENTITLEMENTS
    if plan:
        slot = model_slot(requested_model)
        if slot and ent[plan]["stage2_models"].get(slot) is not None:
            return requested_model
    return CHEAP_MODEL


def daily_review_cap(plan, model, ent=None):
    """Per-user, per-day review cap for (plan, resolved stage-2 model). None -> 0.
    `ent` overrides the compiled ENTITLEMENTS map (T1 overlay)."""
    if not plan:
        return 0
    ent = ent if ent is not None else ENTITLEMENTS
    caps = ent[plan]["stage2_models"]
    slot = model_slot(model) or "cheap"
    cap = caps.get(slot)
    if cap is None:
        cap = caps.get("cheap", 0)
    return cap


def monthly_allowance(plan, kind, ent=None):
    """Monthly generation allowance for kind in ('resume','cover'). None -> 0.
    `ent` overrides the compiled ENTITLEMENTS map (T1 overlay)."""
    if not plan:
        return 0
    ent = ent if ent is not None else ENTITLEMENTS
    e = ent[plan]
    return e["monthly_resume"] if kind == "resume" else e["monthly_cover"]
