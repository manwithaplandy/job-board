"""Per-tier default stage-2 model (config.default_stage2_model).

When a user hasn't picked a stage-2 model, the reviewer falls back to their tier's
default — Pro to a stronger model than Standard — env-overridable per tier. These assert
the compiled defaults, the env override, and that the default still flows through the
entitlement gate correctly (so the metered cap is the tier-appropriate one).
"""
from reviewer import config, entitlements

_STD_ENV = "REVIEW_DEFAULT_MODEL_STANDARD"
_PRO_ENV = "REVIEW_DEFAULT_MODEL_PRO"


def _clear(monkeypatch):
    monkeypatch.delenv(_STD_ENV, raising=False)
    monkeypatch.delenv(_PRO_ENV, raising=False)


def test_compiled_defaults(monkeypatch):
    _clear(monkeypatch)
    assert config.default_stage2_model("standard") == entitlements.CHEAP_MODEL
    assert config.default_stage2_model("pro") == "gemini-flash-latest"


def test_unknown_or_none_plan_falls_back_to_cheap(monkeypatch):
    _clear(monkeypatch)
    assert config.default_stage2_model(None) == entitlements.CHEAP_MODEL
    assert config.default_stage2_model("platinum") == entitlements.CHEAP_MODEL


def test_env_override_per_tier(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_PRO_ENV, "anthropic/claude-sonnet-5")
    monkeypatch.setenv(_STD_ENV, "openai/gpt-5.4-mini")
    assert config.default_stage2_model("pro") == "anthropic/claude-sonnet-5"
    assert config.default_stage2_model("standard") == "openai/gpt-5.4-mini"


def test_blank_env_falls_back_to_compiled(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_PRO_ENV, "   ")
    assert config.default_stage2_model("pro") == "gemini-flash-latest"


def test_default_flows_through_entitlement_gate(monkeypatch):
    """The compiled defaults resolve to themselves for their own tier and meter at the
    tier-appropriate cap: Pro's gemini default is unassigned → premium cap; Standard's
    cheap default → cheap cap."""
    _clear(monkeypatch)
    pro_default = config.default_stage2_model("pro")
    std_default = config.default_stage2_model("standard")

    assert entitlements.resolve_stage2_model("pro", pro_default) == pro_default
    assert entitlements.resolve_stage2_model("standard", std_default) == std_default

    # Pro's default is an unassigned model → premium slot → the Pro premium daily cap.
    assert entitlements.daily_review_cap("pro", pro_default) == 100
    # Standard's default is the cheap model → the Standard cheap daily cap.
    assert entitlements.daily_review_cap("standard", std_default) == 400


def test_standard_cannot_reach_pro_default(monkeypatch):
    """A Standard plan can't run Pro's (premium-tier) default model — it clamps to cheap.
    Guards against the default silently granting unentitled access."""
    _clear(monkeypatch)
    pro_default = config.default_stage2_model("pro")
    assert entitlements.resolve_stage2_model("standard", pro_default) == entitlements.CHEAP_MODEL
