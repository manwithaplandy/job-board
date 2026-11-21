"""Fail on squawk findings that are not part of the destructive set.

Usage: python -m tools.migrations.squawk_gate squawk.json

squawk exits non-zero for any finding. Destructive findings (drops, renames,
type changes, TRUNCATE ... CASCADE) are allowed here because the classifier
routes them to the approval-gated deploy path instead. Every other finding,
including syntax errors, fails the step. The cutover baseline files
(``*_baseline.sql``, ``*_baseline_storage.sql``) are a dump of production and
are exempt, as they are from ``check_rules`` rules 2 to 5.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.migrations.check_rules import BASELINE, is_non_transactional
from tools.migrations.classify import squawk_rule_is_destructive

# squawk assumes every file runs in a transaction (.squawk.toml); a file with the
# non-transactional header is the one place CONCURRENTLY is allowed.
NON_TRANSACTIONAL_OK = {"ban-concurrent-index-creation-in-transaction"}


def _non_transactional(path: str) -> bool:
    try:
        return is_non_transactional(Path(path).read_text())
    except OSError:
        return False


def blocking_findings(findings: list[dict]) -> list[dict]:
    blocking = []
    for f in findings:
        rule = f.get("rule_name", "")
        if BASELINE.search(Path(f.get("file", "")).name):
            continue
        if squawk_rule_is_destructive(rule):
            continue
        if rule in NON_TRANSACTIONAL_OK and _non_transactional(f.get("file", "")):
            continue
        blocking.append(f)
    return blocking


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: python -m tools.migrations.squawk_gate squawk.json", file=sys.stderr)
        return 2
    text = Path(args[0]).read_text().strip()
    findings = json.loads(text) if text else []
    blocking = blocking_findings(findings)
    for f in findings:
        kind = "blocking" if f in blocking else "allowed"
        print(f"{f['file']}:{f.get('line', 0)}: {f['rule_name']}: {f['message']} [{kind}]")
    for f in blocking:
        print(f"::error file={f['file']}::{f['rule_name']}: {f['message']}", file=sys.stderr)
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
