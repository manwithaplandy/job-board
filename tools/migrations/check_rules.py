"""File rules for pipeline migrations in supabase/migrations/.

Usage: python -m tools.migrations.check_rules FILE...

Prints ``file: message`` for every violation and exits 1 if there is any.
The rules (docs/runbooks/migrations-cd.md):

1. the name is ``<14-digit version>_<lower_snake_slug>.sql``;
2. the first two statements are ``SET lock_timeout = '<n>s'`` (n <= 5, or
   the same in ms) and ``SET statement_timeout = <positive value>``;
3. no top-level BEGIN / START TRANSACTION / COMMIT / ROLLBACK / ABORT,
   because the CLI already runs each file in its own transaction;
4. no reference to ``schema_migrations`` (the CLI keeps the history);
5. no ``CONCURRENTLY`` (it cannot run inside the file's transaction);
6. ``*_baseline.sql`` and ``*_baseline_storage.sql`` are exempt from 2-5.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from tools.migrations.sqltext import split_statements, strip_comments

FILENAME = re.compile(r"^\d{14}_[a-z0-9_]+\.sql$")
BASELINE = re.compile(r"_baseline(_storage)?\.sql$")
LOCK_TIMEOUT = re.compile(
    r"^SET\s+(?:LOCAL\s+)?lock_timeout\s*(?:=|TO)\s*'(\d+)\s*(ms|s)'$", re.IGNORECASE
)
STATEMENT_TIMEOUT = re.compile(
    r"^SET\s+(?:LOCAL\s+)?statement_timeout\s*(?:=|TO)\s*(?:'(\d+)\s*(ms|s|min)?'|(\d+))$",
    re.IGNORECASE,
)
TRANSACTION_CONTROL = re.compile(
    r"^(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|ABORT)\b", re.IGNORECASE
)
CONCURRENTLY = re.compile(r"\bCONCURRENTLY\b", re.IGNORECASE)

MAX_LOCK_TIMEOUT_MS = 5000


def _lock_timeout_ok(raw: str) -> bool:
    match = LOCK_TIMEOUT.match(" ".join(raw.split()))
    if not match:
        return False
    value = int(match.group(1)) * (1000 if match.group(2).lower() == "s" else 1)
    return 0 < value <= MAX_LOCK_TIMEOUT_MS


def _statement_timeout_ok(raw: str) -> bool:
    match = STATEMENT_TIMEOUT.match(" ".join(raw.split()))
    if not match:
        return False
    return int(match.group(1) or match.group(3)) > 0


def check_text(name: str, text: str) -> list[str]:
    """Return rule violations for a migration called ``name`` with ``text``."""
    problems: list[str] = []
    if not FILENAME.match(name):
        problems.append(
            "file name must be <14-digit version>_<lower_snake_slug>.sql "
            "(create it with `supabase migration new <slug>`)"
        )
    if BASELINE.search(name):
        return problems

    statements = split_statements(text)
    first = statements[0].raw if statements else ""
    second = statements[1].raw if len(statements) > 1 else ""
    if not _lock_timeout_ok(first):
        problems.append("first statement must be SET lock_timeout = '<n>s' with n <= 5")
    if not _statement_timeout_ok(second):
        problems.append("second statement must be SET statement_timeout = '<positive value>'")
    for statement in statements:
        if TRANSACTION_CONTROL.match(statement.code):
            word = statement.code.split()[0].upper()
            problems.append(
                f"top-level {word} is not allowed; the pipeline runs each file in one transaction"
            )
    if "schema_migrations" in strip_comments(text):
        problems.append(
            "do not touch schema_migrations; the Supabase CLI records migration history"
        )
    if any(CONCURRENTLY.search(s.code) for s in statements):
        problems.append(
            "CONCURRENTLY cannot run inside the file's transaction; use a plain "
            "CREATE INDEX or ask for a non-transactional migration"
        )
    return problems


def check_file(path: Path) -> list[str]:
    return check_text(path.name, path.read_text())


def main(argv: list[str] | None = None) -> int:
    paths = [Path(p) for p in (sys.argv[1:] if argv is None else argv)]
    failed = False
    for path in paths:
        for problem in check_file(path):
            failed = True
            print(f"{path}: {problem}")
    if not failed:
        print(f"Migration file rules: {len(paths)} file(s) OK")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
