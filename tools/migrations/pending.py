"""Which migrations the Deploy workflow should apply, and whether it may.

Usage::

    # Plan migrations job (no secrets): files added since the last good deploy.
    python -m tools.migrations.pending candidates --dir supabase/migrations [--added-file F]

    # Migrate job (production credentials): the authoritative pending set.
    supabase migration list --linked > history.txt
    python -m tools.migrations.pending pending --dir supabase/migrations --listing history.txt
    python -m tools.migrations.pending gate --listing history.txt \\
        [--classification classification.json] --reviewed-env true|false

``candidates`` prints one path per line. ``--added-file`` holds the paths that
``git diff --diff-filter=A`` reported since the last successful Deploy run; leave
it out when there is no such run and every non-baseline file is a candidate.

``gate`` exits 1 when production's history has a version the repository does
not know, when a pending version is missing from the classification, or when a
destructive version is pending and the job is not running in the reviewed
environment (``production-db-destructive``). It fails closed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Iterable
from pathlib import Path

from tools.migrations import history

MIGRATION = re.compile(r"^(\d{14})_[^/]+\.sql$")
BASELINE = re.compile(r"^\d{14}_baseline(_[a-z0-9_]+)?\.sql$")


class GateError(Exception):
    """The Migrate job must not apply anything."""


def version_of(name: str) -> str | None:
    match = MIGRATION.match(name)
    return match.group(1) if match else None


def baseline_versions(names: Iterable[str]) -> set[str]:
    """Versions of the cutover baseline files (``<ts>_baseline*.sql``)."""
    return {name[:14] for name in names if BASELINE.match(name)}


def candidates(
    all_files: Iterable[str],
    added_since_last_success: Iterable[str] | None,
    baselines: set[str],
) -> list[str]:
    """Migration file names to plan for, sorted, never a baseline.

    ``all_files`` are the names in ``supabase/migrations`` now. Added paths that
    no longer exist, or are not migration files, are dropped.
    """
    present = {name for name in all_files if version_of(name)}
    if added_since_last_success is None:
        chosen = present
    else:
        chosen = {Path(path).name for path in added_since_last_success} & present
    return sorted(name for name in chosen if version_of(name) not in baselines)


def parse_migration_list(text: str) -> tuple[list[str], list[str]]:
    """(local_only, remote_only) versions from ``supabase migration list``."""
    local_only, remote_only = [], []
    for local, remote in history.parse(text):
        if local and not remote:
            local_only.append(local)
        elif remote and not local:
            remote_only.append(remote)
    return sorted(local_only), sorted(remote_only)


def by_version(report: dict) -> dict[str, list[str]]:
    """Turn ``classify`` output (keyed by file name) into reasons keyed by version."""
    out: dict[str, list[str]] = {}
    for name, reasons in report.get("files", {}).items():
        version = version_of(name)
        if version:
            out[version] = list(reasons)
    return out


def gate(
    local_only: list[str],
    remote_only: list[str],
    classification: dict[str, list[str]],
    reviewed_env: bool,
) -> None:
    """Raise GateError unless it is safe to push ``local_only`` here."""
    if remote_only:
        raise GateError(
            "prod history has a version the repo does not know: " + ", ".join(remote_only)
        )
    missing = [v for v in local_only if v not in classification]
    if missing:
        raise GateError("pending version not classified: " + ", ".join(missing))
    destructive = [v for v in local_only if classification[v]]
    if destructive and not reviewed_env:
        raise GateError(
            "destructive pending migration outside production-db-destructive: "
            + ", ".join(destructive)
        )


def _names(directory: Path) -> list[str]:
    return sorted(p.name for p in directory.glob("*.sql"))


def _cmd_candidates(args: argparse.Namespace) -> int:
    names = _names(args.dir)
    added = None
    if args.added_file is not None:
        added = [line.strip() for line in args.added_file.read_text().splitlines() if line.strip()]
    for name in candidates(names, added, baseline_versions(names)):
        print(args.dir / name)
    return 0


def _cmd_pending(args: argparse.Namespace) -> int:
    local_only, _remote_only = parse_migration_list(args.listing.read_text())
    files = {version_of(name): name for name in _names(args.dir) if version_of(name)}
    missing = [v for v in local_only if v not in files]
    if missing:
        print("listed locally but no file: " + ", ".join(missing), file=sys.stderr)
        return 1
    for version in local_only:
        print(args.dir / files[version])
    return 0


def _cmd_gate(args: argparse.Namespace) -> int:
    local_only, remote_only = parse_migration_list(args.listing.read_text())
    report = json.loads(args.classification.read_text()) if args.classification else {}
    try:
        gate(local_only, remote_only, by_version(report), args.reviewed_env == "true")
    except GateError as exc:
        print(f"::error::{exc}")
        return 1
    print("pending: " + (", ".join(local_only) if local_only else "nothing"))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m tools.migrations.pending")
    sub = parser.add_subparsers(dest="command", required=True)

    cand = sub.add_parser("candidates", help="files added since the last good deploy")
    cand.add_argument("--dir", type=Path, required=True)
    cand.add_argument("--added-file", type=Path)
    cand.set_defaults(func=_cmd_candidates)

    pend = sub.add_parser("pending", help="files production has not applied")
    pend.add_argument("--dir", type=Path, required=True)
    pend.add_argument("--listing", type=Path, required=True)
    pend.set_defaults(func=_cmd_pending)

    gt = sub.add_parser("gate", help="refuse unsafe pushes")
    gt.add_argument("--listing", type=Path, required=True)
    gt.add_argument("--classification", type=Path)
    gt.add_argument("--reviewed-env", choices=["true", "false"], required=True)
    gt.set_defaults(func=_cmd_gate)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
