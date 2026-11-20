import subprocess

import pytest

from tools.migrations.pr_scope import (
    Row,
    added_migrations,
    immutability_violations,
    is_pipeline_change,
    main,
    ordering_violations,
    parse_rows,
    standalone_violations,
)

NEW = "supabase/migrations/20261121000000_add_widget.sql"


def test_parse_rows_handles_renames():
    rows = parse_rows("A\tschema.sql\nR100\tmigrations/a.sql\tmigrations/archive/a.sql\n")
    assert rows == [Row("A", "schema.sql"), Row("R", "migrations/archive/a.sql", "migrations/a.sql", 100)]


def test_added_migrations():
    rows = [Row("A", NEW), Row("A", "supabase/migrations/.gitkeep"), Row("M", "schema.sql")]
    assert added_migrations(rows) == [NEW]


def test_standalone_allows_schema_tests_and_docs():
    rows = [Row("A", NEW), Row("M", "schema.sql"), Row("M", "tests/test_x.py"),
            Row("A", "dashboard/lib/foo.test.ts"), Row("M", "docs/a.md"), Row("M", "README.md"),
            Row("M", "supabase/schema-sync-expected-diff.json"), Row("A", "dashboard/tests/x.ts")]
    assert standalone_violations(rows) == []


def test_standalone_flags_code_next_to_a_migration():
    rows = [Row("A", NEW), Row("M", "dashboard/lib/foo.ts"), Row("M", "reviewer/run.py")]
    assert standalone_violations(rows) == ["dashboard/lib/foo.ts", "reviewer/run.py"]


def test_standalone_ignores_prs_without_migrations():
    assert standalone_violations([Row("M", "dashboard/lib/foo.ts")]) == []


@pytest.mark.parametrize("status", ["M", "D"])
def test_merged_migrations_are_immutable(status):
    assert immutability_violations([Row(status, NEW)])


def test_renaming_a_migration_is_refused():
    row = Row("R", "supabase/migrations/20261122000000_x.sql", NEW, 100)
    assert immutability_violations([row])


@pytest.mark.parametrize("status", ["A", "M", "D"])
def test_archive_is_frozen(status):
    assert immutability_violations([Row(status, "migrations/archive/2026-06-24-reviews.sql")])


def test_one_time_move_into_the_archive_is_allowed_before_it_exists():
    row = Row("R", "migrations/archive/2026-06-24-reviews.sql", "migrations/2026-06-24-reviews.sql", 100)
    assert immutability_violations([row], base_has_archive=False) == []
    assert immutability_violations([row], base_has_archive=True)
    edited = Row("R", row.path, row.old_path, 90)
    assert immutability_violations([edited], base_has_archive=False)


def test_adding_a_migration_is_fine():
    assert immutability_violations([Row("A", NEW)]) == []


def test_ordering():
    existing = ["supabase/migrations/20261121000000_a.sql", "supabase/migrations/.gitkeep"]
    assert ordering_violations(["supabase/migrations/20261121000001_b.sql"], existing) == []
    assert ordering_violations(["supabase/migrations/20261120235959_b.sql"], existing)
    assert ordering_violations(["supabase/migrations/20261121000000_c.sql"], existing)
    assert ordering_violations([NEW], []) == []


@pytest.mark.parametrize(
    ("path", "expected"),
    [(".github/workflows/ci.yml", True), ("supabase/config.toml", True),
     ("tools/migrations/classify.py", True), (".squawk.toml", True),
     ("requirements-ci.txt", True), ("dashboard/app/page.tsx", False), (NEW, False)],
)
def test_pipeline_change(path, expected):
    assert is_pipeline_change([Row("M", path)]) is expected


def _git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


def test_cli_against_a_scratch_repository(tmp_path, monkeypatch, capsys):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "t@example.com")
    _git(repo, "config", "user.name", "t")
    (repo / "supabase/migrations").mkdir(parents=True)
    (repo / "supabase/migrations/20261121000000_a.sql").write_text("SELECT 1;\n")
    (repo / "app.py").write_text("x = 1\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "base")
    _git(repo, "checkout", "-q", "-b", "feature")
    (repo / "supabase/migrations/20261121000001_b.sql").write_text("SELECT 2;\n")
    (repo / "app.py").write_text("x = 2\n")
    _git(repo, "add", ".")
    _git(repo, "commit", "-q", "-m", "change")
    out = tmp_path / "out.txt"
    monkeypatch.chdir(repo)
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    assert main(["--base", "main"]) == 1
    text = capsys.readouterr().out
    assert "20261121000001_b.sql" in text
    assert "app.py" in text
    assert out.read_text() == (
        'pipeline_change=false\nadded=["supabase/migrations/20261121000001_b.sql"]\n'
    )
