import json
from pathlib import Path

import pytest

from tools.migrations.classify import classify, main

ROOT = Path(__file__).resolve().parents[2]
HEADER = "SET lock_timeout = '5s';\nSET statement_timeout = '60s';\n"


@pytest.mark.parametrize(
    "rule",
    ["ban-drop-column", "ban-drop-table", "ban-drop-not-null", "ban-truncate-cascade",
     "changing-column-type", "renaming-column", "renaming-table"],
)
def test_squawk_rules_flag(rule):
    assert classify(HEADER + "SELECT 1;", {rule}) == [f"squawk: {rule}"]


def test_other_squawk_rules_do_not_flag():
    assert classify(HEADER + "SELECT 1;", {"require-timeout-settings", "prefer-bigint-over-int"}) == []


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE widget;",
        "drop table if exists widget;",
        "DROP SCHEMA old CASCADE;",
        "DROP FUNCTION f();",
        "DROP VIEW v;",
        "DROP MATERIALIZED VIEW mv;",
        "DROP TYPE t;",
        "ALTER TABLE widget DROP COLUMN size;",
        "ALTER TABLE ONLY public.widget DROP size;",
        "ALTER TABLE widget ALTER COLUMN size TYPE bigint;",
        "ALTER TABLE widget RENAME COLUMN size TO width;",
        "ALTER TABLE widget RENAME TO gadget;",
        "TRUNCATE widget;",
        "DELETE FROM widget;",
        "UPDATE widget SET size = 0;",
    ],
)
def test_destructive_statements_flag(sql):
    assert classify(HEADER + sql)


@pytest.mark.parametrize(
    "sql",
    [
        "CREATE TABLE widget (id bigint PRIMARY KEY);",
        "ALTER TABLE widget ADD COLUMN size int;",
        "ALTER TABLE widget DROP CONSTRAINT widget_size_check;",
        "ALTER TABLE widget ALTER COLUMN size DROP DEFAULT;",
        "UPDATE widget SET size = 0 WHERE size IS NULL;",
        "DELETE FROM widget WHERE id = 1;",
        "DROP INDEX widget_size_idx;",
        "DROP POLICY p ON widget;",
        "CREATE TRIGGER t BEFORE TRUNCATE ON widget FOR EACH STATEMENT EXECUTE FUNCTION f();",
        (
            "CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$\n"
            "BEGIN\n  IF TG_OP='TRUNCATE' THEN DROP TABLE IF EXISTS scratch; END IF;\n"
            "  RETURN NULL;\nEND\n$$;"
        ),
        "SELECT 'DROP TABLE widget';",
        "-- DROP TABLE widget;\nSELECT 1;",
    ],
)
def test_safe_statements_do_not_flag(sql):
    assert classify(HEADER + sql) == []


def test_author_can_force_destructive():
    assert classify(HEADER + "-- migration: destructive\nSELECT 1;") == ["author-forced"]


@pytest.mark.parametrize("marker", ["-- migration: safe", "-- migration: not-destructive"])
def test_author_cannot_clear_a_flag(marker):
    assert classify(HEADER + f"{marker}\nDROP TABLE widget;")


def test_regression_identity_pilot_is_destructive():
    pilot = (ROOT / "migrations/archive/2026-10-15-15-identity-exploratory-pilot.sql").read_text()
    assert classify(pilot, {"ban-drop-not-null"})


def test_cli_reports_and_always_exits_zero(tmp_path, capsys):
    safe = tmp_path / "20261121000000_add.sql"
    safe.write_text(HEADER + "ALTER TABLE widget ADD COLUMN size int;")
    risky = tmp_path / "20261121000001_drop.sql"
    risky.write_text(HEADER + "SELECT 1;")
    squawk = tmp_path / "squawk.json"
    squawk.write_text(json.dumps([{"file": str(risky), "rule_name": "ban-drop-column"}]))
    assert main(["--squawk-json", str(squawk), str(safe), str(risky)]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["destructive"] is True
    assert report["files"][safe.name] == []
    assert report["files"][risky.name] == ["squawk: ban-drop-column"]


def test_cli_without_squawk_output(tmp_path, capsys):
    safe = tmp_path / "20261121000000_add.sql"
    safe.write_text(HEADER + "SELECT 1;")
    assert main([str(safe)]) == 0
    assert json.loads(capsys.readouterr().out) == {"destructive": False, "files": {safe.name: []}}
