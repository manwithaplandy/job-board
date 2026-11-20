"""Fail on squawk findings that are not part of the destructive set.

Usage: python -m tools.migrations.squawk_gate squawk.json

squawk exits non-zero for any finding. Destructive findings (drops, renames,
type changes, TRUNCATE ... CASCADE) are allowed here because the classifier
routes them to the approval-gated deploy path instead. Every other finding,
including syntax errors, fails the step.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from tools.migrations.classify import squawk_rule_is_destructive


def blocking_findings(findings: list[dict]) -> list[dict]:
    return [f for f in findings if not squawk_rule_is_destructive(f.get("rule_name", ""))]


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("usage: python -m tools.migrations.squawk_gate squawk.json", file=sys.stderr)
        return 2
    text = Path(args[0]).read_text().strip()
    findings = json.loads(text) if text else []
    for f in findings:
        kind = "destructive (gated at deploy)" if squawk_rule_is_destructive(f["rule_name"]) else "blocking"
        print(f"{f['file']}:{f.get('line', 0)}: {f['rule_name']}: {f['message']} [{kind}]")
    blocking = blocking_findings(findings)
    for f in blocking:
        print(f"::error file={f['file']}::{f['rule_name']}: {f['message']}", file=sys.stderr)
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
