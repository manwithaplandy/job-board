import sys

import pytest

from tools.migrations import history
from tools.migrations.prod_dsn import build_dsn, main

POOLER = "postgresql://postgres.abc123@aws-0-us-east-1.pooler.supabase.com:6543/postgres"


def test_build_dsn_uses_session_pooler_and_encodes_password():
    dsn = build_dsn(POOLER + "\n", "abc123", "p@ss/w:rd%")
    assert dsn == (
        "postgresql://postgres.abc123:p%40ss%2Fw%3Ard%25"
        "@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
    )


@pytest.mark.parametrize(
    ("url", "ref", "password"),
    [("postgresql://x@evil.example.com:5432/postgres", "abc123", "p"),
     (POOLER, "abc;123", "p"), (POOLER, "abc123", "")],
)
def test_build_dsn_rejects_bad_input(url, ref, password):
    with pytest.raises(ValueError):
        build_dsn(url, ref, password)


def test_main_masks_and_passes_dsn(tmp_path, monkeypatch, capfd):
    pooler = tmp_path / "pooler-url"
    pooler.write_text(POOLER)
    monkeypatch.setenv("PROJECT_REF", "abc123")
    monkeypatch.setenv("SUPABASE_DB_PASSWORD", "secret")
    code = main(["--pooler-file", str(pooler), "--", sys.executable, "-c",
                 "import os,sys; sys.exit(0 if os.environ['PROD_DSN'].startswith('postgresql://') else 3)"])
    assert code == 0
    out = capfd.readouterr().out
    assert out.startswith("::add-mask::postgresql://")
    assert out.count("secret") == 1


def test_main_needs_the_pooler_file(tmp_path):
    assert main(["--pooler-file", str(tmp_path / "missing"), "--", "true"]) == 2


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
