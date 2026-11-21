import json

from tools.migrations.squawk_gate import blocking_findings, main


def _finding(rule, file="supabase/migrations/20261121000000_x.sql"):
    return {"file": file, "line": 1, "rule_name": rule, "message": "m"}


def test_destructive_rules_do_not_block():
    findings = [_finding("ban-drop-column"), _finding("renaming-table"), _finding("changing-column-type")]
    assert blocking_findings(findings) == []


def test_other_rules_and_syntax_errors_block():
    findings = [_finding("constraint-missing-not-valid"), _finding("syntax-error"), _finding("ban-drop-table")]
    assert [f["rule_name"] for f in blocking_findings(findings)] == ["constraint-missing-not-valid", "syntax-error"]


def test_cli(tmp_path, capsys):
    path = tmp_path / "squawk.json"
    path.write_text(json.dumps([_finding("ban-drop-column")]))
    assert main([str(path)]) == 0
    path.write_text(json.dumps([_finding("adding-required-field")]))
    assert main([str(path)]) == 1
    path.write_text("")
    assert main([str(path)]) == 0
    assert "ban-drop-column" in capsys.readouterr().out


def test_concurrent_index_rule_is_allowed_only_in_non_transactional_files(tmp_path):
    nt = tmp_path / "20261121000000_nt.sql"
    nt.write_text("-- migration: non-transactional\nSET lock_timeout = '5s';\n")
    plain = tmp_path / "20261121000001_plain.sql"
    plain.write_text("SET lock_timeout = '5s';\n")
    rule = "ban-concurrent-index-creation-in-transaction"
    findings = [_finding(rule, str(nt)), _finding(rule, str(plain))]
    assert [f["file"] for f in blocking_findings(findings)] == [str(plain)]


def test_baseline_files_never_block():
    # The cutover baseline is a dump of prod; squawk's style rules don't apply to it.
    findings = [
        _finding("prefer-bigint-over-int", "supabase/migrations/20261121225347_baseline.sql"),
        _finding("ban-alter-identity", "supabase/migrations/20261121225347_baseline.sql"),
        _finding("syntax-error", "supabase/migrations/20261121225348_baseline_storage.sql"),
        _finding("prefer-bigint-over-int", "supabase/migrations/20261122000000_baseline_fix.sql"),
    ]
    assert [f["file"] for f in blocking_findings(findings)] == [
        "supabase/migrations/20261122000000_baseline_fix.sql"
    ]
