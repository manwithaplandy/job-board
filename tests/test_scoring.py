import pytest

from reviewer.scoring import (
    DENY_CAP, compute_fit,
)


def _fit(**kw):
    base = dict(
        skills_score=100, experience_score=100, comp_score=100,
        experience_match="match", confidence="high", red_flags=[], verdict="approve",
    )
    base.update(kw)
    return compute_fit(**base)


def test_perfect_inputs_clamp_to_100():
    assert _fit() == 100


def test_weighted_base_only():
    # base = 0.45*100 + 0.30*0 + 0.25*0 = 45; no bonuses (unknown match/confidence)
    assert compute_fit(skills_score=100, experience_score=0, comp_score=0,
                       experience_match=None, confidence="medium",
                       red_flags=[], verdict="approve") == 45


def test_experience_and_confidence_bonuses_apply():
    # base 60 (=0.45*40+0.30*60+0.25*60? compute exactly): use simple numbers
    # base = 0.45*60+0.30*60+0.25*60 = 60; far_reach -8; low -5 -> 47
    assert compute_fit(skills_score=60, experience_score=60, comp_score=60,
                       experience_match="far_reach", confidence="low",
                       red_flags=[], verdict="approve") == 47


def test_red_flag_penalty_caps_at_three_flags():
    # base 100, +4 +3 = 107, minus min(9, 3*4)=9 -> 98 -> clamp 98
    assert _fit(red_flags=["a", "b", "c", "d"]) == 98


def test_deny_caps_score():
    assert _fit(verdict="deny") == DENY_CAP


def test_none_inputs_score_zero():
    assert compute_fit(skills_score=None, experience_score=None, comp_score=None,
                       experience_match=None, confidence=None,
                       red_flags=None, verdict=None) == 0


def test_unknown_enum_keys_contribute_zero_bonus():
    assert compute_fit(skills_score=40, experience_score=40, comp_score=40,
                       experience_match="bogus", confidence="bogus",
                       red_flags=[], verdict="approve") == 40
