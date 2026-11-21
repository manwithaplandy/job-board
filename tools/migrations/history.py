"""Read ``supabase migration list`` output.

Usage::

    supabase migration list --db-url "$PROD_DSN" > history.txt
    python -m tools.migrations.history remote history.txt     # remote versions, one per line
    python -m tools.migrations.history check-synced history.txt

``check-synced`` exits 1 unless every row has the same version locally and
remotely. On a terminal the CLI draws a plain table; written to a file
(CLI 2.122.0) it wraps every cell in backticks, with "` `" for an empty side.
Both forms parse the same.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

_ANSI = re.compile(r"\x1b\[[0-9;]*m")
_VERSION = re.compile(r"^\d{14}$")


def parse(text: str) -> list[tuple[str, str]]:
    """Return (local, remote) pairs; a missing side is an empty string."""
    rows = []
    for line in _ANSI.sub("", text).splitlines():
        if "|" not in line:
            continue
        cells = [c.strip().strip("`").strip() for c in line.split("|")]
        local, remote = cells[0], cells[1]
        if not (_VERSION.match(local) or _VERSION.match(remote)):
            continue
        rows.append((local, remote))
    return rows


def unsynced(rows: list[tuple[str, str]]) -> list[tuple[str, str]]:
    return [(local, remote) for local, remote in rows if local != remote]


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2 or args[0] not in ("remote", "check-synced"):
        print("usage: python -m tools.migrations.history remote|check-synced FILE", file=sys.stderr)
        return 2
    rows = parse(Path(args[1]).read_text())
    if args[0] == "remote":
        for _local, remote in rows:
            if remote:
                print(remote)
        return 0
    problems = unsynced(rows)
    for local, remote in problems:
        print(f"local={local or '-'} remote={remote or '-'}")
    if not rows:
        print("no migrations listed", file=sys.stderr)
        return 1
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
