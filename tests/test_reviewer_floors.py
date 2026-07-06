"""Unit tests for reviewer.floors — deterministic post-parse floors for the
work_arrangement / seniority soft fields (plan phases J1 + J2).

Pure functions, no DB. Floors fire ONLY when the model abstained ("unknown");
they never override a real model judgment, and never map remote=False/None to
"onsite".
"""
from reviewer import backfill_floors, floors

# ── J1: work_arrangement floor from the ATS remote flag ──────────────────────


def test_work_arrangement_unknown_remote_true_floors_to_remote():
    assert floors.floor_work_arrangement("unknown", True) == "remote"


def test_work_arrangement_never_overrides_non_unknown():
    # A real model judgment is never overridden, even when remote is True.
    assert floors.floor_work_arrangement("hybrid", True) == "hybrid"


def test_work_arrangement_unknown_remote_false_unchanged():
    assert floors.floor_work_arrangement("unknown", False) == "unknown"


def test_work_arrangement_unknown_remote_none_never_onsite():
    # remote=None (unknown flag) must NEVER be read as onsite.
    assert floors.floor_work_arrangement("unknown", None) == "unknown"


def test_work_arrangement_none_input_untouched():
    # Only the literal "unknown" is floored; a None field stays None.
    assert floors.floor_work_arrangement(None, True) is None


# ── J2: seniority floor from a single title ladder word ──────────────────────


def test_seniority_recovers_senior():
    assert floors.floor_seniority("unknown", "Senior Data Analyst") == "senior"


def test_seniority_recovers_staff():
    assert floors.floor_seniority("unknown", "Staff Software Engineer") == "staff"


def test_seniority_recovers_junior_from_intern():
    assert floors.floor_seniority("unknown", "Engineering Intern") == "junior"


def test_seniority_recovers_senior_from_abbreviation():
    assert floors.floor_seniority("unknown", "Sr. Backend Engineer") == "senior"


def test_seniority_recovers_principal():
    assert floors.floor_seniority("unknown", "Principal Engineer") == "principal"


def test_seniority_recovers_lead():
    assert floors.floor_seniority("unknown", "Lead Developer") == "lead"


# ── \b word-boundary guards (regression-critical) ────────────────────────────


def test_seniority_word_boundary_leaders():
    # "Leaders" must NOT match \blead\b.
    assert floors.floor_seniority("unknown", "AI for Leaders") == "unknown"


def test_seniority_word_boundary_internal():
    # "Internal" must NOT match \bintern\b.
    assert floors.floor_seniority("unknown", "Internal Tools Engineer") == "unknown"


def test_seniority_word_boundary_management():
    # "Management" must NOT match (and "manager" is excluded entirely).
    assert floors.floor_seniority("unknown", "Management Trainee") == "unknown"


# ── dual-level titles stay unknown ───────────────────────────────────────────


def test_seniority_dual_level_stays_unknown():
    # Two ladder hits → abstain kept, never a coin-flip pick.
    assert floors.floor_seniority("unknown", "Senior/Staff Engineer") == "unknown"


# ── genuine unknowns (no ladder word) ────────────────────────────────────────


def test_seniority_genuine_unknown_open_application():
    assert floors.floor_seniority("unknown", "Open Application") == "unknown"


def test_seniority_genuine_unknown_evergreen():
    assert floors.floor_seniority("unknown", "Create Your Own Role!") == "unknown"


# ── never overrides a real model value ───────────────────────────────────────


def test_seniority_non_unknown_untouched():
    assert floors.floor_seniority("mid", "Senior Engineer") == "mid"


# ── "manager" is deliberately excluded (compound role names) ─────────────────


def test_seniority_manager_excluded():
    assert floors.floor_seniority("unknown", "Product Manager") == "unknown"


# ── defensive: no title ──────────────────────────────────────────────────────


def test_seniority_none_title_unchanged():
    assert floors.floor_seniority("unknown", None) == "unknown"


def test_seniority_empty_title_unchanged():
    assert floors.floor_seniority("unknown", "") == "unknown"


# ── backfill row-transform helper (reviewer.backfill_floors) ─────────────────
# A pure per-row decision so the one-time backfill is testable without a DB. It
# shares reviewer.floors as the single source of truth for the regexes.


def test_backfill_floors_seniority_change():
    row = {"seniority": "unknown", "work_arrangement": "onsite",
           "title": "Senior Data Analyst", "remote": False}
    assert backfill_floors.compute_floor_update(row) == {
        "seniority": "senior", "work_arrangement": "onsite"}


def test_backfill_floors_work_arrangement_change():
    row = {"seniority": "mid", "work_arrangement": "unknown",
           "title": "Data Analyst", "remote": True}
    assert backfill_floors.compute_floor_update(row) == {
        "seniority": "mid", "work_arrangement": "remote"}


def test_backfill_floors_both_change():
    row = {"seniority": "unknown", "work_arrangement": "unknown",
           "title": "Staff Engineer", "remote": True}
    assert backfill_floors.compute_floor_update(row) == {
        "seniority": "staff", "work_arrangement": "remote"}


def test_backfill_floors_no_change_returns_none():
    # Genuine unknown title + non-remote → nothing to floor → no UPDATE.
    row = {"seniority": "unknown", "work_arrangement": "unknown",
           "title": "Open Application", "remote": None}
    assert backfill_floors.compute_floor_update(row) is None
