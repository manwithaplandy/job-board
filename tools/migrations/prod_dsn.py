"""Run a command with the production DSN in ``$PROD_DSN``, never printing it.

Usage::

    python -m tools.migrations.prod_dsn -- bash -euo pipefail -c '
      supabase migration list --db-url "$PROD_DSN" > history.txt
    '

The DSN comes from the ``SUPABASE_DB_URL`` secret: the Session pooler string
from the Supabase dashboard's Connect button (IPv4, port 5432, user
``postgres.<project ref>``) with the database password filled in. This module
checks that it points at that pooler and at the ``$PROJECT_REF`` project,
percent-encodes the password (it may be pasted raw or already encoded), adds
``sslmode=require``, masks the result in the Actions log, then runs the
command with ``PROD_DSN`` set. Workflows pass ``$PROD_DSN`` to the Supabase
CLI's ``--db-url``, to ``psql`` and to the fingerprint tool, so no Supabase
access token is needed.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from urllib.parse import quote, unquote

POOLER_SUFFIX = ".pooler.supabase.com"
SESSION_PORT = "5432"
SCHEMES = ("postgresql://", "postgres://")


def build_dsn(db_url: str, project_ref: str) -> tuple[str, str]:
    """Return ``(dsn, password)`` for a Session pooler URL, or raise ValueError.

    Error messages never include the URL or the password.
    """
    url = db_url.strip()
    scheme = next((s for s in SCHEMES if url.startswith(s)), None)
    if scheme is None:
        raise ValueError("SUPABASE_DB_URL must start with postgresql://")
    if not project_ref.isalnum():
        raise ValueError("PROJECT_REF must be alphanumeric")
    rest = url[len(scheme):]
    # The host can never hold "@", so the last one ends the user and password,
    # which may hold any character when pasted raw.
    userinfo, sep, hostpart = rest.rpartition("@")
    if not sep:
        raise ValueError("SUPABASE_DB_URL has no user and password")
    user, sep, password = userinfo.partition(":")
    if not sep or not password or password == "[YOUR-PASSWORD]":
        raise ValueError("SUPABASE_DB_URL has no password; fill in the database password")
    if unquote(user) != f"postgres.{project_ref}":
        raise ValueError("SUPABASE_DB_URL user must be postgres.<project ref> (Session pooler)")
    hostport, _, path = hostpart.partition("/")
    host, _, port = hostport.rpartition(":")
    if not host.endswith(POOLER_SUFFIX):
        raise ValueError("SUPABASE_DB_URL must point at the Supabase pooler (Session pooler)")
    if port != SESSION_PORT:
        raise ValueError("SUPABASE_DB_URL must use port 5432 (Session pooler, not Transaction)")
    database = path.partition("?")[0]
    if database != "postgres":
        raise ValueError("SUPABASE_DB_URL must name the postgres database")
    raw_password = unquote(password)
    dsn = (
        f"postgresql://postgres.{project_ref}:{quote(raw_password, safe='')}"
        f"@{host}:{SESSION_PORT}/postgres?sslmode=require"
    )
    return dsn, raw_password


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a command with $PROD_DSN set.")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("no command given")
    try:
        dsn, password = build_dsn(
            os.environ.get("SUPABASE_DB_URL", ""), os.environ.get("PROJECT_REF", "")
        )
    except ValueError as err:
        print(f"::error::{err}", file=sys.stderr)
        return 2
    for secret in dict.fromkeys((dsn, password, quote(password, safe=""))):
        print(f"::add-mask::{secret}", flush=True)
    env = {k: v for k, v in os.environ.items() if k != "SUPABASE_DB_URL"}
    env["PROD_DSN"] = dsn
    return subprocess.run(command, env=env, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
