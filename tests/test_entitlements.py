from datetime import datetime, timedelta, timezone

from psycopg.types.json import Json

from reviewer import db as reviewer_db
from reviewer.entitlements import (
    CHEAP_MODEL,
    ENTITLEMENTS,
    PREMIUM_MODEL,
    daily_review_cap,
    model_slot,
    monthly_allowance,
    overlay_entitlements,
    plan_tier,
    resolve_plan,
    resolve_stage2_model,
    stage2_model_tier,
)
from tests.conftest import requires_db

NOW = datetime(2026, 7, 3, tzinfo=timezone.utc)
GEMINI = "google/gemini-3.5-flash"


def _sub(plan, status, days):
    return {"plan": plan, "status": status, "current_period_end": NOW + timedelta(days=days)}


def test_resolve_plan_active():
    assert resolve_plan(_sub("pro", "active", 10), False, NOW) == "pro"


def test_resolve_plan_trialing():
    assert resolve_plan(_sub("standard", "trialing", 5), False, NOW) == "standard"


def test_resolve_plan_trialing_pro_clamped_to_standard():
    # An unpaid trial must NOT unlock Pro's premium-model budget (mirrors entitlements.ts).
    assert resolve_plan(_sub("pro", "trialing", 5), False, NOW) == "standard"
    # A paid (active) Pro still gets the full plan.
    assert resolve_plan(_sub("pro", "active", 5), False, NOW) == "pro"


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


def test_resolve_plan_override_downgrades_paying_sub():
    ov = {"plan": "standard", "expires_at": None}
    assert resolve_plan(_sub("pro", "active", 10), False, NOW, override=ov) == "standard"


def test_resolve_plan_override_comps_stranger_to_pro():
    ov = {"plan": "pro", "expires_at": None}
    assert resolve_plan(None, False, NOW, override=ov) == "pro"


def test_resolve_plan_override_beats_comp_plan_none():
    ov = {"plan": "standard", "expires_at": None}
    assert resolve_plan(None, True, NOW, comp_plan="none", override=ov) == "standard"


def test_resolve_plan_override_expiry():
    active = {"plan": "pro", "expires_at": NOW + timedelta(days=1)}
    lapsed = {"plan": "pro", "expires_at": NOW - timedelta(days=1)}
    assert resolve_plan(None, False, NOW, override=active) == "pro"
    assert resolve_plan(None, True, NOW, override=lapsed) == "standard"  # falls back to comp
    assert resolve_plan(None, False, NOW, override=lapsed) is None


def test_resolve_plan_override_junk_plan_is_inert():
    assert resolve_plan(None, False, NOW, override={"plan": "platinum", "expires_at": None}) is None


def test_resolve_plan_override_not_trial_clamped():
    ov = {"plan": "pro", "expires_at": None}
    assert resolve_plan(_sub("pro", "trialing", 5), False, NOW, override=ov) == "pro"


def test_resolve_stage2_model_standard_falls_back():
    assert resolve_stage2_model("standard", PREMIUM_MODEL) == CHEAP_MODEL


def test_resolve_stage2_model_pro_premium():
    assert resolve_stage2_model("pro", PREMIUM_MODEL) == PREMIUM_MODEL


def test_resolve_stage2_model_arbitrary_and_blank():
    # Was: a non-whitelist model clamped to CHEAP even for Pro. Now Pro's tier grants any
    # catalog model; Standard is still clamped; a blank request or null plan falls back.
    assert resolve_stage2_model("pro", "some/other") == "some/other"
    assert resolve_stage2_model("standard", "some/other") == CHEAP_MODEL
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
    # Tier-derived (was a two-id whitelist): tier-1 -> cheap, everything else -> premium,
    # never None.
    assert model_slot(CHEAP_MODEL) == "cheap"
    assert model_slot(PREMIUM_MODEL) == "premium"
    assert model_slot("x") == "premium"
    assert model_slot(None) == "premium"


def test_plan_tier_ranks():
    assert plan_tier(None) == 0
    assert plan_tier("standard") == 1
    assert plan_tier("pro") == 2


def test_stage2_model_tier_default_is_pro():
    assert stage2_model_tier(CHEAP_MODEL) == 1
    assert stage2_model_tier(GEMINI) == 2
    assert stage2_model_tier(PREMIUM_MODEL) == 2
    assert stage2_model_tier(None) == 2


def test_gpt_nano_is_standard_available_cheap_slot():
    # gpt-5.4-nano is a tier-1 (Standard-available) model, metered at the cheap cap.
    assert stage2_model_tier("openai/gpt-5.4-nano") == 1
    assert model_slot("openai/gpt-5.4-nano") == "cheap"
    assert resolve_stage2_model("standard", "openai/gpt-5.4-nano") == "openai/gpt-5.4-nano"
    assert resolve_stage2_model("pro", "openai/gpt-5.4-nano") == "openai/gpt-5.4-nano"
    assert daily_review_cap("standard", "openai/gpt-5.4-nano") == 400


def test_resolve_stage2_pro_runs_any_model_standard_clamped():
    assert resolve_stage2_model("pro", GEMINI) == GEMINI
    assert resolve_stage2_model("pro", PREMIUM_MODEL) == PREMIUM_MODEL
    assert resolve_stage2_model("standard", GEMINI) == CHEAP_MODEL
    assert resolve_stage2_model("standard", PREMIUM_MODEL) == CHEAP_MODEL
    assert resolve_stage2_model(None, GEMINI) == CHEAP_MODEL


def test_model_slot_tier_derived():
    assert model_slot(CHEAP_MODEL) == "cheap"
    assert model_slot(GEMINI) == "premium"
    assert model_slot(PREMIUM_MODEL) == "premium"


def test_daily_cap_pro_gemini_is_premium_cap():
    assert daily_review_cap("pro", GEMINI) == 100
    assert daily_review_cap("pro", CHEAP_MODEL) == 1000
    assert daily_review_cap("standard", CHEAP_MODEL) == 400
    assert daily_review_cap(None, GEMINI) == 0


# ── T1: DB-overridable tier config (overlay_entitlements + load_tier_settings) ──

def test_overlay_empty_is_defaults():
    assert overlay_entitlements([]) == ENTITLEMENTS


def test_overlay_valid_override_changes_cap():
    ent = overlay_entitlements([{"plan": "standard", "config": {"stage2Models": {"cheap": 650}}}])
    assert ent["standard"]["stage2_models"]["cheap"] == 650
    # Enforcement path honors the overlay.
    assert daily_review_cap("standard", CHEAP_MODEL, ent) == 650
    # Other plan/fields untouched, compiled map never mutated.
    assert ent["pro"]["stage2_models"]["cheap"] == 1000
    assert ENTITLEMENTS["standard"]["stage2_models"]["cheap"] == 400


def test_overlay_override_allowances_and_premium():
    ent = overlay_entitlements([
        {"plan": "pro", "config": {"stage2Models": {"premium": 250}, "monthlyResume": 200}},
    ])
    assert ent["pro"]["stage2_models"]["premium"] == 250
    assert ent["pro"]["monthly_resume"] == 200
    assert ent["pro"]["monthly_cover"] == 100  # untouched default


def test_overlay_malformed_falls_back_field_by_field():
    # String scalar config, negative/zero/fractional caps, and unknown keys all fall
    # back to the compiled defaults without raising.
    ent = overlay_entitlements([
        {"plan": "standard", "config": "not-an-object"},
        {"plan": "pro", "config": {
            "stage2Models": {"cheap": -5, "premium": 0},
            "monthlyResume": 3.5,
            "monthlyCover": True,     # bool is not a valid int here
            "bogusKey": 999,
        }},
    ])
    assert ent == ENTITLEMENTS


def test_overlay_cannot_invent_standard_premium_slot():
    ent = overlay_entitlements([{"plan": "standard", "config": {"stage2Models": {"premium": 100}}}])
    assert "premium" not in ent["standard"]["stage2_models"]


@requires_db
def test_load_tier_settings_override_and_fallback(conn):
    # Valid override row → enforced cap changes.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO tier_settings (plan, config) VALUES (%s, %s)",
            ("standard", Json({"stage2Models": {"cheap": 650}, "monthlyResume": 45})),
        )
    conn.commit()
    ent = reviewer_db.load_tier_settings(conn)
    assert daily_review_cap("standard", CHEAP_MODEL, ent) == 650
    assert monthly_allowance("standard", "resume", ent) == 45

    # Malformed row → field-by-field fallback to compiled defaults.
    with conn.cursor() as cur:
        cur.execute("UPDATE tier_settings SET config = %s WHERE plan = %s",
                    (Json({"stage2Models": {"cheap": -1}}), "standard"))
    conn.commit()
    ent2 = reviewer_db.load_tier_settings(conn)
    assert daily_review_cap("standard", CHEAP_MODEL, ent2) == 400


def test_resolve_plan_comp_plan_variants():
    from reviewer.entitlements import resolve_plan
    # Default: invited -> standard (unchanged Phase-0 behavior).
    assert resolve_plan(None, True) == "standard"
    # Operator-configured comp plans.
    assert resolve_plan(None, True, comp_plan="pro") == "pro"
    assert resolve_plan(None, True, comp_plan="none") is None
    # A live subscription still wins over comp config.
    from datetime import datetime, timedelta, timezone
    sub = {"plan": "pro", "status": "active",
           "current_period_end": datetime.now(timezone.utc) + timedelta(days=10)}
    assert resolve_plan(sub, True, comp_plan="none") == "pro"
    # Not invited: comp plan is irrelevant.
    assert resolve_plan(None, False, comp_plan="pro") is None


def test_parse_comp_plan_total():
    from reviewer.entitlements import parse_comp_plan, DEFAULT_INVITE_COMP_PLAN
    assert parse_comp_plan("pro") == "pro"
    assert parse_comp_plan("none") == "none"
    # A double-encoded jsonb string scalar is unwrapped one level (mirrors TS parseCompPlan)
    # so a double-encoded row comps identically across runtimes.
    assert parse_comp_plan('"pro"') == "pro"
    assert parse_comp_plan('"none"') == "none"
    # Absent row / malformed writes (incl. a double-encoded INVALID value and non-JSON
    # garbage) all degrade to the compiled default.
    for bad in (None, "", "platinum", '"platinum"', "not-json", 3, {"x": 1}, True):
        assert parse_comp_plan(bad) == DEFAULT_INVITE_COMP_PLAN
