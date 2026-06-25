import pytest
from pydantic import ValidationError

from reviewer.schemas import (
    INDUSTRIES,
    SUBCATEGORIES,
    TAXONOMY,
    TAXONOMY_TEXT,
    Stage1Result,
    Stage2Result,
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
