"""Execute the committed ordinary acceptance allowlist, never broad discovery."""

import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    selection = json.loads((ROOT / "tools/lifecycle_test_selection.json").read_text())
    if sys.argv[1:] == ["dashboard"]:
        # Each file owns/reset its fixture schema; never execute files concurrently.
        for path in selection["dashboard_owned"]:
            result = subprocess.run(
                [
                    "node",
                    "node_modules/vitest/vitest.mjs",
                    "run",
                    "--config",
                    "vitest.owned.config.ts",
                    path,
                ],
                cwd=ROOT / "dashboard",
                check=False,
            )
            if result.returncode:
                return result.returncode
        return 0
    if sys.argv[1:]:
        raise SystemExit("usage: run_lifecycle_acceptance.py [dashboard]")
    return subprocess.run(
        [sys.executable, "-m", "pytest", *selection["python"], "-vv", "-ra"],
        cwd=ROOT,
        check=False,
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
