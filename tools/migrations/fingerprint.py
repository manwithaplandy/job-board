"""Catalog fingerprint of a Postgres schema, and a diff between two fingerprints.

A fingerprint is ``{section: {key: value}}`` built from the read-only catalog
queries in ``fingerprint.sql``. CI captures one from the database that the
migrations produce and one from ``schema.sql``, then compares them.

Usage::

    python -m tools.migrations.fingerprint capture --dsn-env VAR --out a.json
    python -m tools.migrations.fingerprint compare a.json b.json \\
        [--ignore supabase/fingerprint-ignore.json] \\
        [--expected supabase/schema-sync-expected-diff.json] \\
        [--skip-sections storage_policies,storage_buckets]

Ignore entries are ``{"section", "key_regex", "reason"}``; ``key_regex`` must
match the whole key (``re.fullmatch``) and ``reason`` must be non-empty.
Expected entries are ``{"section", "key", "side"}`` with side one of
``only-in-A``, ``only-in-B`` or ``differs``; an expected entry that does not
match an actual difference is reported as stale and fails the compare.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path

SQL_PATH = Path(__file__).with_name("fingerprint.sql")
SIDES = ("only-in-A", "only-in-B", "differs")

Fingerprint = dict[str, dict[str, str]]

_SECTION_RE = re.compile(r"^--\s*section:\s*(\w+)\s*$")
_REQUIRES_RE = re.compile(r"^--\s*requires:\s*([\w.]+)\s*$")


@dataclass(frozen=True)
class Section:
    """One catalog query from fingerprint.sql."""

    name: str
    sql: str
    requires: str | None = None


def load_sections(path: Path = SQL_PATH) -> list[Section]:
    """Split fingerprint.sql on ``-- section: <name>`` headers."""
    sections: list[Section] = []
    name: str | None = None
    requires: str | None = None
    lines: list[str] = []

    def flush() -> None:
        if name is not None:
            sql = "\n".join(lines).strip().rstrip(";").strip()
            if not sql:
                raise ValueError(f"section {name!r} in {path} has no query")
            sections.append(Section(name, sql, requires))

    for line in path.read_text().splitlines():
        header = _SECTION_RE.match(line)
        if header:
            flush()
            name, requires, lines = header.group(1), None, []
            continue
        req = _REQUIRES_RE.match(line)
        if req and name is not None and not lines:
            requires = req.group(1)
            continue
        if name is not None:
            lines.append(line)
    flush()

    names = [s.name for s in sections]
    if len(names) != len(set(names)):
        raise ValueError(f"duplicate section names in {path}: {names}")
    return sections


def capture(dsn: str, read_only: bool = True) -> Fingerprint:
    """Run every section query against ``dsn`` and return the fingerprint.

    Only SELECTs are issued. With ``read_only`` the session is also opened
    with ``default_transaction_read_only=on`` so the server refuses writes.
    ``search_path`` is pinned to ``pg_catalog`` so object names in the output
    are qualified the same way on every server.
    """
    import psycopg  # imported here so compare works without a driver

    options = "-c search_path=pg_catalog"
    if read_only:
        options = "-c default_transaction_read_only=on " + options

    result: Fingerprint = {}
    with psycopg.connect(dsn, options=options) as conn:
        try:
            with conn.cursor() as cur:
                for section in load_sections():
                    rows: dict[str, str] = {}
                    result[section.name] = rows
                    if section.requires:
                        cur.execute("SELECT to_regclass(%s) IS NOT NULL", (section.requires,))
                        if not cur.fetchone()[0]:
                            continue
                    cur.execute(section.sql)
                    for name, key, value in cur.fetchall():
                        if name != section.name:
                            raise ValueError(
                                f"section {section.name!r} query returned section {name!r}"
                            )
                        if key is None:
                            raise ValueError(f"section {section.name!r} returned a NULL key")
                        if key in rows:
                            raise ValueError(
                                f"section {section.name!r} returned duplicate key {key!r}"
                            )
                        rows[key] = "" if value is None else str(value)
        finally:
            conn.rollback()
    return result


@dataclass
class Diff:
    """Result of comparing two fingerprints."""

    unexpected: list[tuple[str, str, str]] = field(default_factory=list)
    stale_expected: list[dict] = field(default_factory=list)

    @property
    def clean(self) -> bool:
        """True when nothing unexpected differs and no expected entry is stale."""
        return not self.unexpected and not self.stale_expected


def _validate_ignore(ignore: Iterable[dict]) -> list[tuple[str, re.Pattern[str]]]:
    """Check ignore entries and compile their regexes."""
    compiled = []
    for entry in ignore:
        reason = entry.get("reason")
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError(f"ignore entry needs a non-empty reason: {entry!r}")
        if not entry.get("section") or not entry.get("key_regex"):
            raise ValueError(f"ignore entry needs section and key_regex: {entry!r}")
        compiled.append((entry["section"], re.compile(entry["key_regex"])))
    return compiled


def _validate_expected(expected: Iterable[dict]) -> list[dict]:
    """Check expected entries have a section, a key and a known side."""
    entries = list(expected)
    for entry in entries:
        if not entry.get("section") or not entry.get("key"):
            raise ValueError(f"expected entry needs section and key: {entry!r}")
        if entry.get("side") not in SIDES:
            raise ValueError(f"expected entry side must be one of {SIDES}: {entry!r}")
    return entries


def raw_differences(
    a: Fingerprint, b: Fingerprint, skip_sections: Iterable[str] = ()
) -> list[tuple[str, str, str]]:
    """Every (section, key, kind) where ``a`` and ``b`` disagree, sorted."""
    skip = set(skip_sections)
    out = []
    for section in sorted((set(a) | set(b)) - skip):
        rows_a, rows_b = a.get(section, {}), b.get(section, {})
        for key in sorted(set(rows_a) | set(rows_b)):
            if key not in rows_b:
                out.append((section, key, "only-in-A"))
            elif key not in rows_a:
                out.append((section, key, "only-in-B"))
            elif rows_a[key] != rows_b[key]:
                out.append((section, key, "differs"))
    return out


def diff(
    a: Fingerprint,
    b: Fingerprint,
    ignore: Iterable[dict],
    expected: Iterable[dict],
    skip_sections: Iterable[str] = (),
) -> Diff:
    """Compare two fingerprints, applying the ignore and expected lists.

    A difference matching an expected entry (same section, key and side) is
    accepted; otherwise one whose key fully matches an ignore regex in the same
    section is accepted; anything else is unexpected. Expected entries for
    sections that are not skipped but match no difference are stale.
    """
    skip = set(skip_sections)
    ignore_rules = _validate_ignore(ignore)
    expected_entries = _validate_expected(expected)

    wanted = {(e["section"], e["key"], e["side"]) for e in expected_entries}
    used: set[tuple[str, str, str]] = set()
    result = Diff()
    for item in raw_differences(a, b, skip):
        section, key, _kind = item
        if item in wanted:
            used.add(item)
        elif any(s == section and rx.fullmatch(key) for s, rx in ignore_rules):
            continue
        else:
            result.unexpected.append(item)

    result.stale_expected = [
        e
        for e in expected_entries
        if e["section"] not in skip and (e["section"], e["key"], e["side"]) not in used
    ]
    return result


def _read_json(path: str):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, sort_keys=True, indent=2)
        fh.write("\n")


def _cmd_capture(args: argparse.Namespace) -> int:
    dsn = os.environ.get(args.dsn_env)
    if not dsn:
        print(f"error: environment variable {args.dsn_env} is not set", file=sys.stderr)
        return 2
    _write_json(args.out, capture(dsn, read_only=True))
    return 0


def _cmd_compare(args: argparse.Namespace) -> int:
    skip = [s.strip() for s in (args.skip_sections or "").split(",") if s.strip()]
    result = diff(
        _read_json(args.a),
        _read_json(args.b),
        _read_json(args.ignore) if args.ignore else [],
        _read_json(args.expected) if args.expected else [],
        skip,
    )
    for section, key, kind in result.unexpected:
        print(f"{section}: {key}: {kind}")
    for entry in result.stale_expected:
        print(f"stale expected: {entry['section']}: {entry['key']}: {entry['side']}")
    if result.clean:
        print("fingerprints match")
        return 0
    return 1


def main(argv: list[str] | None = None) -> int:
    """CLI entry point; returns the process exit code."""
    parser = argparse.ArgumentParser(prog="python -m tools.migrations.fingerprint")
    sub = parser.add_subparsers(dest="command", required=True)

    cap = sub.add_parser("capture", help="capture a fingerprint from a database")
    cap.add_argument("--dsn-env", required=True, help="name of the env var holding the DSN")
    cap.add_argument("--out", required=True, help="output JSON file")
    cap.set_defaults(func=_cmd_capture)

    cmp_ = sub.add_parser("compare", help="compare two fingerprint files")
    cmp_.add_argument("a")
    cmp_.add_argument("b")
    cmp_.add_argument("--ignore", help="JSON list of {section, key_regex, reason}")
    cmp_.add_argument("--expected", help="JSON list of {section, key, side}")
    cmp_.add_argument("--skip-sections", help="comma-separated section names to skip")
    cmp_.set_defaults(func=_cmd_compare)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
