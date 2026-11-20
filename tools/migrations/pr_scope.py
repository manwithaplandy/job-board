"""Pull-request scope checks for migrations.

Usage: python -m tools.migrations.pr_scope --base origin/main

Prints a markdown report (meant for $GITHUB_STEP_SUMMARY), writes
``pipeline_change`` and ``added`` to $GITHUB_OUTPUT when set, and exits 1
if any rule is broken:

* a PR that adds a migration changes nothing else but tests, docs,
  ``schema.sql`` and the schema snapshot files (schema first, code after);
* merged pipeline migrations are never edited, renamed or deleted, and the
  frozen ``migrations/archive/`` never changes;
* a new migration's version is later than every version already on main.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass

MIGRATION = re.compile(r"^supabase/migrations/(\d{14})_[^/]+\.sql$")
STANDALONE_ALLOWED = [
    re.compile(p)
    for p in (
        r"^supabase/migrations/",
        r"^supabase/snapshots/",
        r"^supabase/schema-sync-expected-diff\.json$",
        r"^schema\.sql$",
        r"^tests/",
        r"^dashboard/tests/",
        r"^dashboard/.+\.test\.tsx?$",
        r"^docs/",
        r"\.md$",
    )
]
PIPELINE_PATHS = [
    re.compile(p)
    for p in (
        r"^\.github/workflows/",
        r"^supabase/config\.toml$",
        r"^tools/migrations/",
        r"^\.squawk\.toml$",
        r"^requirements-ci\.txt$",
    )
]


@dataclass(frozen=True)
class Row:
    """One line of ``git diff --name-status``: status letter, path, old path for renames."""

    status: str
    path: str
    old_path: str | None = None
    score: int | None = None

    def paths(self) -> list[str]:
        return [p for p in (self.old_path, self.path) if p]


def parse_rows(text: str) -> list[Row]:
    rows = []
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        code = parts[0]
        letter = code[0]
        if letter in "RC":
            rows.append(Row(letter, parts[2], parts[1], int(code[1:] or 0)))
        else:
            rows.append(Row(letter, parts[1]))
    return rows


def added_migrations(rows: list[Row]) -> list[str]:
    return sorted(r.path for r in rows if r.status == "A" and MIGRATION.match(r.path))


def standalone_violations(rows: list[Row]) -> list[str]:
    if not added_migrations(rows):
        return []
    offenders = set()
    for row in rows:
        for path in row.paths():
            if not any(p.search(path) for p in STANDALONE_ALLOWED):
                offenders.add(path)
    return sorted(offenders)


def immutability_violations(rows: list[Row], base_has_archive: bool = True) -> list[str]:
    problems = []
    for row in rows:
        for path in row.paths():
            if MIGRATION.match(path) and row.status != "A":
                problems.append(f"{path}: merged migrations are never edited, renamed or deleted")
                break
            if path.startswith("migrations/"):
                moving_into_archive = (
                    not base_has_archive
                    and row.status == "R"
                    and row.score == 100
                    and row.old_path is not None
                    and re.fullmatch(r"migrations/[^/]+\.sql", row.old_path)
                    and row.path == "migrations/archive/" + row.old_path.split("/", 1)[1]
                )
                if not moving_into_archive:
                    problems.append(f"{path}: migrations/archive/ is frozen history")
                break
    return problems


def ordering_violations(added: list[str], existing_on_main: list[str]) -> list[str]:
    versions = [m.group(1) for p in existing_on_main if (m := MIGRATION.match(p))]
    if not versions:
        return []
    latest = max(versions)
    return [
        f"{path}: version must be later than {latest}, the newest migration on main "
        "(recreate it with `supabase migration new`)"
        for path in added
        if (m := MIGRATION.match(path)) and m.group(1) <= latest
    ]


def is_pipeline_change(rows: list[Row]) -> bool:
    return any(p.search(path) for row in rows for path in row.paths() for p in PIPELINE_PATHS)


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def report(rows: list[Row], existing_on_main: list[str], base_has_archive: bool) -> tuple[str, list[str]]:
    added = added_migrations(rows)
    problems = (
        [f"{p}: a PR that adds a migration may only change tests, docs and schema.sql "
         "(ship the code that uses it in a later PR)" for p in standalone_violations(rows)]
        + immutability_violations(rows, base_has_archive)
        + ordering_violations(added, existing_on_main)
    )
    lines = ["## Migrations in this PR", ""]
    lines += [f"- `{p}`" for p in added] or ["No new migrations."]
    if is_pipeline_change(rows):
        lines += ["", "This PR changes the deploy pipeline (`pipeline-change`)."]
    if problems:
        lines += ["", "### Problems", ""] + [f"- {p}" for p in problems]
    return "\n".join(lines) + "\n", problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a PR's migration scope.")
    parser.add_argument("--base", required=True, help="base ref, e.g. origin/main")
    args = parser.parse_args(argv)
    merge_base = _git("merge-base", args.base, "HEAD").strip()
    rows = parse_rows(_git("diff", "--name-status", "-M", merge_base, "HEAD"))
    existing = _git("ls-tree", "-r", "--name-only", args.base, "--", "supabase/migrations").splitlines()
    base_has_archive = bool(
        _git("ls-tree", "--name-only", args.base, "--", "migrations/archive").strip()
    )
    text, problems = report(rows, existing, base_has_archive)
    print(text)
    for problem in problems:
        print(f"::error::{problem}", file=sys.stderr)
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a") as fh:
            fh.write(f"pipeline_change={'true' if is_pipeline_change(rows) else 'false'}\n")
            fh.write(f"added={json.dumps(added_migrations(rows))}\n")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
