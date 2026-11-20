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
