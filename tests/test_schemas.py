import pytest
from pydantic import ValidationError

from typing import get_args

from reviewer.schemas import (
    INDUSTRIES,
    SUBCATEGORIES,
    TAXONOMY,
    TAXONOMY_TEXT,
    Industry,
    Stage1Result,
    Stage2Result,
    Subcategory,
)


def test_stage1_parses_and_rejects_bad_decision():
    assert Stage1Result(decision="pass", reason="ok").decision == "pass"
    with pytest.raises(ValidationError):
        Stage1Result(decision="maybe", reason="x")


def test_stage2_parses_valid_pair():
    r = Stage2Result(
        verdict="approve",
        experience_match="match",
        industry="healthcare_life_sciences",
        industry_subcategory="health_tech_digital_health",
        confidence="high",
        reasoning="Relevant.",
    )
    assert r.industry == "healthcare_life_sciences"


def test_stage2_rejects_unknown_industry():
    with pytest.raises(ValidationError):
        Stage2Result(
            verdict="approve", experience_match="match",
            industry="agriculture", industry_subcategory="gaming",
            confidence="low", reasoning="x",
        )


def test_taxonomy_is_consistent():
    assert set(TAXONOMY) == set(INDUSTRIES)
    flat = [s for subs in TAXONOMY.values() for s in subs]
    assert sorted(flat) == sorted(SUBCATEGORIES)
    assert "health_tech_digital_health" in TAXONOMY_TEXT
    assert set(get_args(Industry)) == set(INDUSTRIES)
    assert set(get_args(Subcategory)) == set(SUBCATEGORIES)


from reviewer.schemas import ROLE_CATEGORIES, Requirement


def test_stage2_defaults_when_new_fields_omitted():
    r = Stage2Result(
        verdict="approve", experience_match="match",
        industry="software_internet", industry_subcategory="devtools_platforms",
        confidence="high", reasoning="ok",
    )
    assert r.role_category == "Other"
    assert r.seniority == "unknown"
    assert r.work_arrangement == "unknown"
    assert r.skills_score == 0 and r.red_flags == [] and r.requirements == []
    assert r.pay_min is None and r.headcount is None


def test_stage2_parses_rich_payload():
    r = Stage2Result(
        verdict="approve", experience_match="match",
        industry="software_internet", industry_subcategory="devtools_platforms",
        confidence="high", reasoning="Strong fit.",
        role_category="Frontend", seniority="senior", work_arrangement="hybrid",
        about="Cobalt builds analytics tooling.",
        pay_min=170000, pay_max=210000, pay_currency="USD", pay_period="year",
        headcount="120", skills_score=96, experience_score=93, comp_score=90,
        red_flags=["Ships daily."], skill_gaps=["WebGL"], benefits=["Equity"],
        requirements=[{"text": "5+ years React", "met": True}],
    )
    assert r.role_category == "Frontend"
    assert r.requirements[0].met is True
    assert isinstance(r.requirements[0], Requirement)


def test_stage2_rejects_unknown_role_category():
    with pytest.raises(ValidationError):
        Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="x", role_category="Astronaut",
        )


def test_role_categories_nonempty_and_has_other():
    assert "Other" in ROLE_CATEGORIES and len(ROLE_CATEGORIES) >= 5
