"""Run a command with a production DSN in ``$PROD_DSN``, never printing it.

Usage (after ``supabase link`` has written the pooler URL)::

    python -m tools.migrations.prod_dsn --pooler-file supabase/.temp/pooler-url -- \\
        python -m tools.migrations.fingerprint capture --dsn-env PROD_DSN --out prod.json

The DSN uses the session pooler (IPv4, port 5432) with user
``postgres.<project ref>``. The password comes from ``$SUPABASE_DB_PASSWORD``
and the ref from ``$PROJECT_REF``; the password is percent-encoded and the
whole DSN is masked in the Actions log before the command starts.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit

POOLER_SUFFIX = ".pooler.supabase.com"


def build_dsn(pooler_url: str, project_ref: str, password: str) -> str:
    host = urlsplit(pooler_url.strip()).hostname
    if not host or not host.endswith(POOLER_SUFFIX):
        raise ValueError("pooler URL does not point at a Supabase pooler host")
    if not project_ref.isalnum():
        raise ValueError("project ref must be alphanumeric")
    if not password:
        raise ValueError("database password is empty")
    return (
        f"postgresql://postgres.{project_ref}:{quote(password, safe='')}"
        f"@{host}:5432/postgres?sslmode=require"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a command with $PROD_DSN set.")
    parser.add_argument("--pooler-file", type=Path, required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("no command given")
    if not args.pooler_file.exists():
        print(f"error: {args.pooler_file} not found; run supabase link first", file=sys.stderr)
        return 2
    dsn = build_dsn(
        args.pooler_file.read_text(),
        os.environ.get("PROJECT_REF", ""),
        os.environ.get("SUPABASE_DB_PASSWORD", ""),
    )
    print(f"::add-mask::{dsn}", flush=True)
    return subprocess.run(command, env={**os.environ, "PROD_DSN": dsn}, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
