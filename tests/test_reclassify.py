import pytest

from company_discovery.reclassify import classify_red_flag, reclassify_flags


@pytest.mark.parametrize("text,category", [
    ("Consulting firm", "consulting_agency"),
    ("consulting/staffing agency", "consulting_agency"),
    ("Defense industry involvement", "defense_military"),
    ("aerospace/defense contractor", "defense_military"),
    ("not a tech company", "non_tech"),
    ("unknown company, cannot verify preferences", "unknown_unverified"),
    ("very early-stage startup with limited public track record", "early_stage_risk"),
    ("cannabis industry may not fit values", "values_mismatch"),
    ("predatory lending practices", "values_mismatch"),
    ("some entirely novel concern", "other"),
])
def test_classify_categories(text, category):
    rf = classify_red_flag(text)
    assert rf is not None
    assert rf.category == category
    assert rf.note == text.strip()


def test_defense_precedes_consulting():
    assert classify_red_flag("defense/intelligence consulting").category == "defense_military"


@pytest.mark.parametrize("text", [
    "no obvious red flags from known information", "none", "   ",
])
def test_non_flags_are_dropped(text):
    assert classify_red_flag(text) is None


def test_reclassify_flags_maps_and_drops():
    out = reclassify_flags(["Consulting firm", "no red flags", "defense industry"])
    assert out == [
        {"category": "consulting_agency", "note": "Consulting firm"},
        {"category": "defense_military", "note": "defense industry"},
    ]


def test_reclassify_flags_idempotent_on_objects():
    already = [{"category": "consulting_agency", "note": "Consulting firm"}]
    assert reclassify_flags(already) == already


def test_reclassify_flags_handles_empty_and_none():
    assert reclassify_flags([]) == []
    assert reclassify_flags(None) == []
