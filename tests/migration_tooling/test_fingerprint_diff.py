"""Unit tests for tools.migrations.fingerprint diff and compare (no database)."""

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

from tools.migrations import fingerprint as fp

REPO_ROOT = Path(__file__).resolve().parents[2]

BASE = {
    "columns": {
        "jobs.id": "text | not null | default= | generated= | identity=",
        "jobs.title": "text | not null | default= | generated= | identity=",
    },
    "constraints": {
        "jobs.jobs_pkey": "PRIMARY KEY (id) | validated=true",
        "jobs.jobs_company_id_fkey": "FOREIGN KEY (company_id) REFERENCES public.companies(id)"
        " | validated=true",
    },
    "rls": {"jobs": "rls=true | force=false"},
    "storage_buckets": {"avatars": "public=false | file_size_limit= | allowed_mime_types="},
}


def _renamed_constraint():
    """BASE with one constraint name changed on side B."""
    b = copy.deepcopy(BASE)
    value = b["constraints"].pop("jobs.jobs_company_id_fkey")
    b["constraints"]["jobs.jobs_company_fk"] = value
    return b


def test_identical_is_clean():
    result = fp.diff(BASE, copy.deepcopy(BASE), [], [])
    assert result.clean
    assert result.unexpected == []
    assert result.stale_expected == []


def test_differing_constraint_name_is_named():
    result = fp.diff(BASE, _renamed_constraint(), [], [])
    assert not result.clean
    assert result.unexpected == [
        ("constraints", "jobs.jobs_company_fk", "only-in-B"),
        ("constraints", "jobs.jobs_company_id_fkey", "only-in-A"),
    ]


def test_value_change_reports_differs():
    b = copy.deepcopy(BASE)
    b["rls"]["jobs"] = "rls=false | force=false"
    assert fp.diff(BASE, b, [], []).unexpected == [("rls", "jobs", "differs")]


def test_missing_section_reports_every_key():
    b = copy.deepcopy(BASE)
    del b["rls"]
    assert fp.diff(BASE, b, [], []).unexpected == [("rls", "jobs", "only-in-A")]


def test_ignore_regex_suppresses():
    ignore = [{"section": "constraints", "key_regex": r"jobs\.jobs_company.*", "reason": "rename"}]
    assert fp.diff(BASE, _renamed_constraint(), ignore, []).clean


def test_ignore_regex_is_section_scoped_and_full_match():
    wrong_section = [{"section": "columns", "key_regex": ".*", "reason": "x"}]
    partial = [{"section": "constraints", "key_regex": "company", "reason": "x"}]
    assert len(fp.diff(BASE, _renamed_constraint(), wrong_section, []).unexpected) == 2
    assert len(fp.diff(BASE, _renamed_constraint(), partial, []).unexpected) == 2


@pytest.mark.parametrize("reason", [None, "", "   "])
def test_ignore_without_reason_raises(reason):
    entry = {"section": "constraints", "key_regex": ".*"}
    if reason is not None:
        entry["reason"] = reason
    with pytest.raises(ValueError, match="reason"):
        fp.diff(BASE, BASE, [entry], [])


def test_expected_entry_suppresses():
    expected = [
        {"section": "constraints", "key": "jobs.jobs_company_fk", "side": "only-in-B"},
        {"section": "constraints", "key": "jobs.jobs_company_id_fkey", "side": "only-in-A"},
    ]
    assert fp.diff(BASE, _renamed_constraint(), [], expected).clean


def test_expected_entry_with_wrong_side_does_not_suppress_and_is_stale():
    expected = [{"section": "constraints", "key": "jobs.jobs_company_fk", "side": "only-in-A"}]
    result = fp.diff(BASE, _renamed_constraint(), [], expected)
    assert ("constraints", "jobs.jobs_company_fk", "only-in-B") in result.unexpected
    assert result.stale_expected == expected


def test_stale_expected_entry_fails():
    expected = [{"section": "rls", "key": "jobs", "side": "differs"}]
    result = fp.diff(BASE, copy.deepcopy(BASE), [], expected)
    assert result.unexpected == []
    assert result.stale_expected == expected
    assert not result.clean


def test_expected_entry_with_bad_side_raises():
    with pytest.raises(ValueError, match="side"):
        fp.diff(BASE, BASE, [], [{"section": "rls", "key": "jobs", "side": "gone"}])


def test_skip_sections():
    b = copy.deepcopy(BASE)
    b["storage_buckets"] = {}
    assert fp.diff(BASE, b, [], []).unexpected == [
        ("storage_buckets", "avatars", "only-in-A")
    ]
    expected_in_skipped = [{"section": "storage_buckets", "key": "x", "side": "differs"}]
    assert fp.diff(BASE, b, [], expected_in_skipped, skip_sections=["storage_buckets"]).clean


def test_sql_file_has_every_section():
    names = [s.name for s in fp.load_sections()]
    assert names == [
        "columns", "constraints", "indexes", "functions", "triggers", "views",
        "policies", "rls", "sequences", "types", "owners", "grants", "default_acl",
        "extensions", "storage_policies", "storage_buckets",
    ]
    requires = {s.name: s.requires for s in fp.load_sections() if s.requires}
    assert requires == {"storage_buckets": "storage.buckets"}


def test_ignore_file_starts_empty():
    path = REPO_ROOT / "supabase" / "fingerprint-ignore.json"
    assert json.loads(path.read_text()) == []


# --- CLI -----------------------------------------------------------------


def _write(tmp_path, name, data):
    path = tmp_path / name
    path.write_text(json.dumps(data))
    return str(path)


def test_compare_cli_clean_exits_zero(tmp_path, capsys):
    a = _write(tmp_path, "a.json", BASE)
    b = _write(tmp_path, "b.json", BASE)
    assert fp.main(["compare", a, b]) == 0
    assert "fingerprints match" in capsys.readouterr().out


def test_compare_cli_difference_exits_one_and_names_key(tmp_path, capsys):
    a = _write(tmp_path, "a.json", BASE)
    b = _write(tmp_path, "b.json", _renamed_constraint())
    assert fp.main(["compare", a, b]) == 1
    out = capsys.readouterr().out.splitlines()
    assert "constraints: jobs.jobs_company_id_fkey: only-in-A" in out
    assert "constraints: jobs.jobs_company_fk: only-in-B" in out


def test_compare_cli_ignore_and_expected_files(tmp_path):
    a = _write(tmp_path, "a.json", BASE)
    b = _write(tmp_path, "b.json", _renamed_constraint())
    ignore = _write(tmp_path, "ignore.json", [
        {"section": "constraints", "key_regex": r"jobs\.jobs_company_fk", "reason": "rename"},
    ])
    expected = _write(tmp_path, "expected.json", [
        {"section": "constraints", "key": "jobs.jobs_company_id_fkey", "side": "only-in-A"},
    ])
    assert fp.main(["compare", a, b, "--ignore", ignore, "--expected", expected]) == 0


def test_compare_cli_stale_expected_exits_one(tmp_path, capsys):
    a = _write(tmp_path, "a.json", BASE)
    expected = _write(tmp_path, "expected.json", [
        {"section": "rls", "key": "jobs", "side": "differs"},
    ])
    assert fp.main(["compare", a, a, "--expected", expected]) == 1
    assert "stale expected: rls: jobs: differs" in capsys.readouterr().out


def test_compare_cli_skip_sections(tmp_path):
    b_data = copy.deepcopy(BASE)
    b_data["storage_buckets"] = {}
    b_data.pop("rls")
    a = _write(tmp_path, "a.json", BASE)
    b = _write(tmp_path, "b.json", b_data)
    assert fp.main(["compare", a, b, "--skip-sections", "storage_buckets"]) == 1
    assert fp.main(["compare", a, b, "--skip-sections", "storage_buckets, rls"]) == 0


def test_compare_cli_as_module_subprocess(tmp_path):
    a = _write(tmp_path, "a.json", BASE)
    b = _write(tmp_path, "b.json", _renamed_constraint())
    cmd = [sys.executable, "-m", "tools.migrations.fingerprint", "compare", a, b]
    proc = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    assert proc.returncode == 1, proc.stderr
    assert "constraints: jobs.jobs_company_id_fkey: only-in-A" in proc.stdout
    proc = subprocess.run(cmd[:-1] + [a], cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stderr


def test_capture_cli_missing_env_var_exits_two(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("FP_TEST_DSN_UNSET", raising=False)
    out = tmp_path / "out.json"
    assert fp.main(["capture", "--dsn-env", "FP_TEST_DSN_UNSET", "--out", str(out)]) == 2
    assert "FP_TEST_DSN_UNSET" in capsys.readouterr().err
    assert not out.exists()
