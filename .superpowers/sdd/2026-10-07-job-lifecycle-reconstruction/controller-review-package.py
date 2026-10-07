#!/usr/bin/env python3
"""Pin full task/fix range; write review package without Git mutation."""
from pathlib import Path
import subprocess
import sys

name, base_input, head_input = sys.argv[1:]
def git(*args):
    return subprocess.check_output(["git", *args], text=True)
base = git("rev-parse", base_input + "^{commit}").strip()
head = git("rev-parse", head_input + "^{commit}").strip()
subprocess.run(["git", "merge-base", "--is-ancestor", base, head], check=True)
workspace = Path(__file__).resolve().parent
out = workspace / (name + "-review-package.md")
parts = ["# Full pinned review package", "BASE: " + base, "HEAD: " + head,
    "## Commits", git("log", "--format=%H %s", base + ".." + head),
    "## Files", git("diff", "--stat", base, head),
    "## Complete diff", git("diff", "--no-ext-diff", "--unified=10", base, head)]
out.write_text("\n\n".join(parts))
print(out)
