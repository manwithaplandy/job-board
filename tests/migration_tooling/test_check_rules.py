import pytest

from tools.migrations.check_rules import check_text, main

GOOD_NAME = "20261121000000_add_widget_table.sql"
HEADER = "SET lock_timeout = '5s';\nSET statement_timeout = '60s';\n"


def ok(sql: str, name: str = GOOD_NAME) -> list[str]:
    return check_text(name, sql)


def test_clean_file_passes():
    assert ok(HEADER + "CREATE TABLE widget (id bigint PRIMARY KEY);") == []


@pytest.mark.parametrize(
    "name",
    ["2026-11-21-widget.sql", "20261121_widget.sql", "20261121000000_Widget.sql",
     "20261121000000-widget.sql", "20261121000000_widget.SQL"],
)
def test_rule1_filename(name):
    assert any("file name" in p for p in ok(HEADER + "SELECT 1;", name))


def test_rule2_header_present_with_comments_and_ms():
    sql = "-- why\nSET lock_timeout TO '3000ms';\n/* x */ SET statement_timeout = 0060000;\nSELECT 1;"
    assert ok(sql) == []


@pytest.mark.parametrize(
    "sql",
    [
        "SET statement_timeout = '60s';\nSET lock_timeout = '5s';\nSELECT 1;",
        "SET lock_timeout = '6s';\nSET statement_timeout = '60s';\nSELECT 1;",
        "SET lock_timeout = '0s';\nSET statement_timeout = '60s';\nSELECT 1;",
        "SET lock_timeout = '5s';\nSELECT 1;",
        "CREATE TABLE t (id int);",
        "SET lock_timeout = '5s';\nSET statement_timeout = '0';\nSELECT 1;",
    ],
)
def test_rule2_header_missing_or_wrong(sql):
    assert any("statement" in p for p in ok(sql))


@pytest.mark.parametrize("stmt", ["BEGIN", "begin transaction", "START TRANSACTION", "COMMIT", "ROLLBACK"])
def test_rule3_top_level_transaction_control(stmt):
    assert any("top-level" in p for p in ok(HEADER + f"{stmt};\nSELECT 1;"))


def test_rule3_allows_begin_inside_plpgsql():
    sql = HEADER + (
        "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$\n"
        "BEGIN\n  PERFORM 1;\nCOMMIT;\nEND\n$$;"
    )
    assert ok(sql) == []


def test_rule4_schema_migrations():
    sql = HEADER + "INSERT INTO public.schema_migrations(filename) VALUES ('x');"
    assert any("schema_migrations" in p for p in ok(sql))


def test_rule4_ignores_comments():
    assert ok(HEADER + "-- unlike the old schema_migrations ledger\nSELECT 1;") == []


NT = "-- migration: non-transactional\n"


def test_rule5_concurrently_needs_the_header():
    sql = HEADER + "CREATE INDEX CONCURRENTLY widget_idx ON widget (id);"
    assert any("CONCURRENTLY" in p for p in ok(sql))


def test_rule5_concurrently_alone_with_the_header_is_allowed():
    assert ok(NT + HEADER + "CREATE INDEX CONCURRENTLY IF NOT EXISTS widget_idx ON widget (id);") == []


@pytest.mark.parametrize(
    "body",
    [
        "CREATE INDEX CONCURRENTLY a ON widget (id);\nCREATE INDEX b ON widget (id);",
        "CREATE INDEX a ON widget (id);",
        "CREATE INDEX CONCURRENTLY a ON widget (id);\nCREATE INDEX CONCURRENTLY b ON widget (x);",
    ],
)
def test_rule5_non_transactional_file_holds_one_concurrent_statement(body):
    assert any("non-transactional" in p for p in ok(NT + HEADER + body))


def test_rule5_header_must_be_the_first_line():
    sql = HEADER + NT + "CREATE INDEX CONCURRENTLY a ON widget (id);"
    assert any("CONCURRENTLY" in p for p in ok(sql))


def test_rule5_ignores_string_literals():
    assert ok(HEADER + "SELECT 'CONCURRENTLY';") == []


@pytest.mark.parametrize(
    "name", ["20261121000000_baseline.sql", "20261121000001_baseline_storage.sql"]
)
def test_rule6_baselines_exempt(name):
    sql = "BEGIN;\nINSERT INTO schema_migrations VALUES ('x');\nCREATE INDEX CONCURRENTLY i ON t (c);\nCOMMIT;"
    assert ok(sql, name) == []



@pytest.mark.parametrize(
    "name", ["20261121000000_add_baseline.sql", "20261121000001_reset_baseline_storage.sql"]
)
def test_rule6_only_exact_baseline_names_are_exempt(name):
    errors = ok("BEGIN;\nSELECT 1;\nCOMMIT;", name)
    assert errors

def test_cli_exit_codes(tmp_path, capsys):
    good = tmp_path / GOOD_NAME
    good.write_text(HEADER + "SELECT 1;")
    bad = tmp_path / "bad.sql"
    bad.write_text("SELECT 1;")
    assert main([str(good)]) == 0
    assert main([str(good), str(bad)]) == 1
    assert "bad.sql: file name" in capsys.readouterr().out
