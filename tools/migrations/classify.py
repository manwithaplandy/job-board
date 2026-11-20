"""Flag migrations that can lose data or break running code.

Usage:
  python -m tools.migrations.classify [--squawk-json FILE] SQL_FILE...

Writes ``{"destructive": bool, "files": {name: [reasons]}}`` to stdout and
always exits 0: it reports, and CD decides (a destructive set waits for
Andrew's approval in the ``production-db-destructive`` environment).

A file is destructive if any of these hold:
* squawk raised a ``ban-drop-*``, ``ban-truncate-cascade``,
  ``changing-column-type``, ``renaming-column`` or ``renaming-table`` rule;
* a top-level statement drops a table, schema, function, view, materialized
  view or type, drops a column, changes a column's type, renames a table or
  column, truncates, or runs DELETE / UPDATE without WHERE;
* the file says ``-- migration: destructive``.
Nothing in a file can clear a flag (``-- migration: safe`` does nothing).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from tools.migrations.sqltext import split_statements

SQUAWK_DESTRUCTIVE = {
    "ban-truncate-cascade",
    "changing-column-type",
    "renaming-column",
    "renaming-table",
}
AUTHOR_FORCED = re.compile(r"--\s*migration:\s*destructive\b", re.IGNORECASE)

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "drops an object",
        re.compile(
            r"^DROP\s+(TABLE|SCHEMA|FUNCTION|PROCEDURE|VIEW|MATERIALIZED\s+VIEW|TYPE|DOMAIN)\b",
            re.IGNORECASE,
        ),
    ),
    ("drops a column", re.compile(r"^ALTER\s+TABLE\b.*\bDROP\s+(COLUMN\s+)?(?!CONSTRAINT\b|DEFAULT\b|NOT\b|IDENTITY\b|EXPRESSION\b)\S+", re.IGNORECASE)),
    ("changes a column type", re.compile(r"^ALTER\s+TABLE\b.*\bALTER\s+(COLUMN\s+)?\S+\s+(SET\s+DATA\s+)?TYPE\b", re.IGNORECASE)),
    ("renames a table or column", re.compile(r"^ALTER\s+TABLE\b.*\bRENAME\b", re.IGNORECASE)),
    ("truncates", re.compile(r"^TRUNCATE\b", re.IGNORECASE)),
]
_DELETE = re.compile(r"^DELETE\s+FROM\b", re.IGNORECASE)
_UPDATE = re.compile(r"^UPDATE\b.*\bSET\b", re.IGNORECASE)
_WHERE = re.compile(r"\bWHERE\b", re.IGNORECASE)


def squawk_rule_is_destructive(rule: str) -> bool:
    """True for squawk rules that mark a statement destructive."""
    return rule.startswith("ban-drop-") or rule in SQUAWK_DESTRUCTIVE


def classify(sql: str, squawk_rules: set[str] | frozenset[str] = frozenset()) -> list[str]:
    """Return the reasons ``sql`` is destructive; an empty list means it is not."""
    reasons = [f"squawk: {rule}" for rule in sorted(squawk_rules) if squawk_rule_is_destructive(rule)]
    for statement in split_statements(sql):
        code = statement.code
        for reason, pattern in _PATTERNS:
            if pattern.search(code):
                reasons.append(f"{reason}: {code[:80]}")
        if _DELETE.match(code) and not _WHERE.search(code):
            reasons.append(f"deletes every row: {code[:80]}")
        if _UPDATE.match(code) and not _WHERE.search(code):
            reasons.append(f"updates every row: {code[:80]}")
    if AUTHOR_FORCED.search(sql):
        reasons.append("author-forced")
    return reasons


def _squawk_rules_by_file(path: Path | None) -> dict[str, set[str]]:
    if path is None or not path.exists() or not path.read_text().strip():
        return {}
    rules: dict[str, set[str]] = {}
    for item in json.loads(path.read_text()):
        rules.setdefault(Path(item["file"]).name, set()).add(item["rule_name"])
    return rules


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--squawk-json", type=Path)
    parser.add_argument("files", nargs="*", type=Path)
    args = parser.parse_args(argv)
    squawk = _squawk_rules_by_file(args.squawk_json)
    files = {
        path.name: classify(path.read_text(), squawk.get(path.name, set()))
        for path in args.files
    }
    report = {"destructive": any(files.values()), "files": files}
    json.dump(report, sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
