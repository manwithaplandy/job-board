from datetime import datetime, timedelta, timezone

from reviewer.entitlements import (
    CHEAP_MODEL,
    PREMIUM_MODEL,
    daily_review_cap,
    model_slot,
    monthly_allowance,
    resolve_plan,
    resolve_stage2_model,
)

NOW = datetime(2026, 7, 3, tzinfo=timezone.utc)


def _sub(plan, status, days):
    return {"plan": plan, "status": status, "current_period_end": NOW + timedelta(days=days)}


def test_resolve_plan_active():
    assert resolve_plan(_sub("pro", "active", 10), False, NOW) == "pro"


def test_resolve_plan_trialing():
    assert resolve_plan(_sub("standard", "trialing", 5), False, NOW) == "standard"


def test_resolve_plan_within_grace():
    assert resolve_plan(_sub("pro", "active", -2), False, NOW) == "pro"


def test_resolve_plan_past_grace():
    assert resolve_plan(_sub("pro", "active", -4), False, NOW) is None


def test_resolve_plan_canceled():
    assert resolve_plan(_sub("pro", "canceled", 10), False, NOW) is None


def test_resolve_plan_comped_invited():
    assert resolve_plan(None, True, NOW) == "standard"
    assert resolve_plan(_sub("pro", "canceled", -40), True, NOW) == "standard"


def test_resolve_plan_stranger():
    assert resolve_plan(None, False, NOW) is None


def test_resolve_plan_none_current_period_end():
    assert resolve_plan({"plan": "pro", "status": "active", "current_period_end": None}, False, NOW) is None


def test_resolve_stage2_model_standard_falls_back():
    assert resolve_stage2_model("standard", PREMIUM_MODEL) == CHEAP_MODEL


def test_resolve_stage2_model_pro_premium():
    assert resolve_stage2_model("pro", PREMIUM_MODEL) == PREMIUM_MODEL


def test_resolve_stage2_model_unknown():
    assert resolve_stage2_model("pro", "some/other") == CHEAP_MODEL
    assert resolve_stage2_model("pro", None) == CHEAP_MODEL
    assert resolve_stage2_model(None, PREMIUM_MODEL) == CHEAP_MODEL


def test_daily_review_cap():
    assert daily_review_cap("standard", CHEAP_MODEL) == 400
    assert daily_review_cap("pro", CHEAP_MODEL) == 1000
    assert daily_review_cap("pro", PREMIUM_MODEL) == 100
    assert daily_review_cap(None, CHEAP_MODEL) == 0


def test_monthly_allowance():
    assert monthly_allowance("standard", "resume") == 30
    assert monthly_allowance("standard", "cover") == 30
    assert monthly_allowance("pro", "resume") == 100
    assert monthly_allowance("pro", "cover") == 100
    assert monthly_allowance(None, "resume") == 0


def test_model_slot():
    assert model_slot(CHEAP_MODEL) == "cheap"
    assert model_slot(PREMIUM_MODEL) == "premium"
    assert model_slot("x") is None
    assert model_slot(None) is None
