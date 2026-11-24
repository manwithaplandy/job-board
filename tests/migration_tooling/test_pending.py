import json

import pytest

from tools.migrations import pending

BASE = "20261121000000_baseline.sql"
BASE_STORAGE = "20261121000001_baseline_storage.sql"
PILOT_A = "20261122000000_identity_pilot_a.sql"
PILOT_B = "20261122000001_identity_pilot_b.sql"
ALL = [BASE, BASE_STORAGE, PILOT_A, PILOT_B]

LISTING = """
  \x1b[1m Local          | Remote         | Time (UTC)          \x1b[0m
  ----------------|----------------|---------------------
   20261121000000 | 20261121000000 | 2026-11-21 00:00:00
   20261121000001 | 20261121000001 | 2026-11-21 00:00:01
   20261122000000 |                | 2026-11-22 00:00:00
   20261122000001 |                | 2026-11-22 00:00:01
"""


def test_baseline_versions_are_found_by_name():
    assert pending.baseline_versions(ALL) == {"20261121000000", "20261121000001"}


def test_candidates_are_added_files_minus_baselines():
    added = [f"supabase/migrations/{BASE}", f"supabase/migrations/{PILOT_A}"]
    assert pending.candidates(ALL, added, pending.baseline_versions(ALL)) == [PILOT_A]


def test_candidates_without_an_earlier_success_are_every_non_baseline_file():
    assert pending.candidates(ALL, None, pending.baseline_versions(ALL)) == [PILOT_A, PILOT_B]


def test_candidates_ignore_added_paths_that_are_not_migrations():
    added = ["supabase/migrations/README.md", "supabase/migrations/notes.sql"]
    assert pending.candidates(ALL, added, pending.baseline_versions(ALL)) == []


def test_candidates_ignore_added_files_since_deleted():
    added = ["supabase/migrations/20261123000000_gone.sql"]
    assert pending.candidates(ALL, added, set()) == []


def test_parse_migration_list():
    assert pending.parse_migration_list(LISTING) == (
        ["20261122000000", "20261122000001"],
        [],
    )


def test_parse_migration_list_remote_only():
    text = LISTING + "                  | 20251015120000 | 2025-10-15 12:00:00\n"
    assert pending.parse_migration_list(text)[1] == ["20251015120000"]


def test_gate_passes_safe_pending_in_the_plain_environment():
    pending.gate(["20261122000000"], [], {"20261122000000": []}, reviewed_env=False)


def test_gate_refuses_unknown_remote_versions():
    with pytest.raises(pending.GateError, match="prod history has a version the repo does not know"):
        pending.gate([], ["20251015120000"], {}, reviewed_env=True)


def test_gate_refuses_destructive_pending_outside_the_reviewed_environment():
    with pytest.raises(pending.GateError, match="destructive"):
        pending.gate(
            ["20261122000000"], [], {"20261122000000": ["drops a column"]}, reviewed_env=False
        )


def test_gate_allows_destructive_pending_in_the_reviewed_environment():
    pending.gate(
        ["20261122000000"], [], {"20261122000000": ["drops a column"]}, reviewed_env=True
    )


def test_gate_fails_closed_on_an_unclassified_pending_version():
    with pytest.raises(pending.GateError, match="not classified"):
        pending.gate(["20261122000000"], [], {}, reviewed_env=False)


def test_by_version_maps_classify_output():
    report = {"destructive": True, "files": {PILOT_A: ["truncates"], PILOT_B: []}}
    assert pending.by_version(report) == {
        "20261122000000": ["truncates"],
        "20261122000001": [],
    }


def _write_tree(tmp_path):
    mig = tmp_path / "migrations"
    mig.mkdir()
    for name in ALL:
        (mig / name).write_text("select 1;\n")
    return mig


def test_cli_candidates(tmp_path, capsys):
    mig = _write_tree(tmp_path)
    added = tmp_path / "added.txt"
    added.write_text(f"supabase/migrations/{PILOT_B}\n")
    assert pending.main(["candidates", "--dir", str(mig), "--added-file", str(added)]) == 0
    assert capsys.readouterr().out.splitlines() == [str(mig / PILOT_B)]


def test_cli_candidates_without_added_file(tmp_path, capsys):
    mig = _write_tree(tmp_path)
    assert pending.main(["candidates", "--dir", str(mig)]) == 0
    assert capsys.readouterr().out.splitlines() == [str(mig / PILOT_A), str(mig / PILOT_B)]


def test_cli_pending_files(tmp_path, capsys):
    mig = _write_tree(tmp_path)
    listing = tmp_path / "history.txt"
    listing.write_text(LISTING)
    assert pending.main(["pending", "--dir", str(mig), "--listing", str(listing)]) == 0
    assert capsys.readouterr().out.splitlines() == [str(mig / PILOT_A), str(mig / PILOT_B)]


def test_cli_pending_refuses_a_local_version_with_no_file(tmp_path, capsys):
    mig = _write_tree(tmp_path)
    (mig / PILOT_B).unlink()
    listing = tmp_path / "history.txt"
    listing.write_text(LISTING)
    assert pending.main(["pending", "--dir", str(mig), "--listing", str(listing)]) == 1


@pytest.mark.parametrize(
    ("reasons", "reviewed", "code"),
    [([], "false", 0), (["truncates"], "false", 1), (["truncates"], "true", 0)],
)
def test_cli_gate(tmp_path, reasons, reviewed, code):
    listing = tmp_path / "history.txt"
    listing.write_text(LISTING)
    report = tmp_path / "classification.json"
    report.write_text(json.dumps({"destructive": bool(reasons), "files": {PILOT_A: reasons, PILOT_B: []}}))
    args = ["gate", "--listing", str(listing), "--classification", str(report), "--reviewed-env", reviewed]
    assert pending.main(args) == code


def test_cli_gate_with_nothing_pending_needs_no_classification(tmp_path):
    listing = tmp_path / "history.txt"
    listing.write_text(
        "   20261121000000 | 20261121000000 | 2026-11-21 00:00:00\n"
    )
    assert pending.main(["gate", "--listing", str(listing), "--reviewed-env", "false"]) == 0
