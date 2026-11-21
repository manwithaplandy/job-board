"""The pre-pipeline migrations are frozen history.

`migrations/archive/` holds the 66 hand-applied files from before the CI/CD
overhaul. Nothing may change them, and no new file may go next to them: new
schema changes live in `supabase/migrations/` and are applied by the pipeline.
`public.schema_migrations` (the old hand-kept ledger) is frozen too, so
`schema.sql` keeps exactly today's inserts into it and new migrations never
touch it.
"""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / "migrations" / "archive"
SUPABASE_MIGRATIONS = ROOT / "supabase" / "migrations"

ARCHIVE_FILE_COUNT = 66
ARCHIVE_SHA256 = "41b3164af53d194fd128c4026e8cb3861918cc3e229d52d6cc90b9e4b61edb18"
SCHEMA_SQL_LEDGER_INSERTS = 21

_LEDGER_INSERT = re.compile(
    r"insert\s+into\s+(public\.)?schema_migrations\b", re.IGNORECASE
)


def _archive_digest(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        digest.update(path.name.encode() + b"\0" + path.read_bytes() + b"\0")
    return digest.hexdigest()


def test_archive_holds_exactly_the_frozen_files():
    files = sorted(ARCHIVE.glob("*.sql"))
    assert len(files) == ARCHIVE_FILE_COUNT
    assert _archive_digest(files) == ARCHIVE_SHA256, (
        "migrations/archive/ is frozen history; add new migrations under "
        "supabase/migrations/ instead"
    )


def test_no_migration_files_outside_the_archive():
    assert sorted((ROOT / "migrations").glob("*.sql")) == []


def test_schema_sql_ledger_inserts_are_frozen():
    schema = (ROOT / "schema.sql").read_text()
    assert len(_LEDGER_INSERT.findall(schema)) == SCHEMA_SQL_LEDGER_INSERTS


def test_pipeline_migrations_never_touch_the_old_ledger():
    offenders = [
        path.name
        for path in SUPABASE_MIGRATIONS.glob("*.sql")
        if "schema_migrations" in path.read_text()
    ]
    assert offenders == []
