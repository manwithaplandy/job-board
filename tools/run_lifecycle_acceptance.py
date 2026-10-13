"""Execute the committed ordinary acceptance allowlist, never broad discovery."""

import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    selection = json.loads((ROOT / "tools/lifecycle_test_selection.json").read_text())
    if sys.argv[1:] == ["dashboard"]:
        # setup-python in CI need not create a repository-local virtualenv.
        env = dict(os.environ, LIFECYCLE_TEST_PYTHON=sys.executable)
        print(f"Owned dashboard Python: {sys.executable}", flush=True)
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
                env=env,
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
