import sys

import pytest

from tools.migrations import history
from tools.migrations.prod_dsn import build_dsn, main

HOST = "aws-0-us-east-1.pooler.supabase.com"
URL = f"postgresql://postgres.abc123:secret@{HOST}:5432/postgres"
EXPECTED = f"postgresql://postgres.abc123:secret@{HOST}:5432/postgres?sslmode=require"


def test_build_dsn_keeps_session_pooler_and_adds_ssl():
    assert build_dsn(URL + "\n", "abc123") == (EXPECTED, "secret")


@pytest.mark.parametrize("password", ["p@ss/w:rd#?", "p%40ss%2Fw%3Ard%23%3F"])
def test_build_dsn_encodes_raw_or_encoded_passwords(password):
    dsn, raw = build_dsn(f"postgres://postgres.abc123:{password}@{HOST}:5432/postgres", "abc123")
    assert raw == "p@ss/w:rd#?"
    assert dsn == f"postgresql://postgres.abc123:p%40ss%2Fw%3Ard%23%3F@{HOST}:5432/postgres?sslmode=require"


@pytest.mark.parametrize(
    ("url", "ref"),
    [
        ("https://postgres.abc123:p@" + HOST + ":5432/postgres", "abc123"),
        ("postgresql://postgres.abc123:p@db.abc123.supabase.co:5432/postgres", "abc123"),
        ("postgresql://postgres.abc123:p@evil.example.com:5432/postgres", "abc123"),
        ("postgresql://postgres.abc123:p@" + HOST + ":6543/postgres", "abc123"),
        ("postgresql://postgres.other:p@" + HOST + ":5432/postgres", "abc123"),
        ("postgresql://postgres:p@" + HOST + ":5432/postgres", "abc123"),
        ("postgresql://postgres.abc123@" + HOST + ":5432/postgres", "abc123"),
        ("postgresql://postgres.abc123:[YOUR-PASSWORD]@" + HOST + ":5432/postgres", "abc123"),
        ("postgresql://postgres.abc123:p@" + HOST + ":5432/other", "abc123"),
        (URL, "abc;123"),
        ("", "abc123"),
    ],
)
def test_build_dsn_rejects_bad_input(url, ref):
    with pytest.raises(ValueError) as err:
        build_dsn(url, ref)
    assert "secret" not in str(err.value) and ":p@" not in str(err.value)


def test_main_masks_and_passes_dsn(monkeypatch, capfd):
    monkeypatch.setenv("PROJECT_REF", "abc123")
    monkeypatch.setenv("SUPABASE_DB_URL", URL)
    check = (
        "import os,sys; sys.exit(0 if os.environ['PROD_DSN'] == %r"
        " and 'SUPABASE_DB_URL' not in os.environ else 3)" % EXPECTED
    )
    assert main(["--", sys.executable, "-c", check]) == 0
    lines = capfd.readouterr().out.splitlines()
    assert lines == [f"::add-mask::{EXPECTED}", "::add-mask::secret"]


def test_main_refuses_a_bad_url_without_printing_it(monkeypatch, capfd):
    monkeypatch.setenv("PROJECT_REF", "abc123")
    monkeypatch.setenv("SUPABASE_DB_URL", URL.replace("5432", "6543"))
    assert main(["--", "true"]) == 2
    captured = capfd.readouterr()
    assert "secret" not in captured.out + captured.err
    assert "::error::" in captured.err


LISTING = """
  \x1b[1m Local          | Remote         | Time (UTC)          \x1b[0m
  ----------------|----------------|---------------------
   20261201000000 | 20261201000000 | 2026-12-01 00:00:00
                  | 20251015120000 | 2025-10-15 12:00:00
   20261202000000 |                | 2026-12-02 00:00:00
"""


def test_parse_listing():
    assert history.parse(LISTING) == [
        ("20261201000000", "20261201000000"),
        ("", "20251015120000"),
        ("20261202000000", ""),
    ]
    assert history.unsynced(history.parse(LISTING)) == [("", "20251015120000"), ("20261202000000", "")]


def test_history_cli(tmp_path, capsys):
    path = tmp_path / "history.txt"
    path.write_text(LISTING)
    assert history.main(["remote", str(path)]) == 0
    assert capsys.readouterr().out.split() == ["20261201000000", "20251015120000"]
    assert history.main(["check-synced", str(path)]) == 1
    path.write_text("   20261201000000 | 20261201000000 | x\n")
    assert history.main(["check-synced", str(path)]) == 0
    path.write_text("")
    assert history.main(["check-synced", str(path)]) == 1
