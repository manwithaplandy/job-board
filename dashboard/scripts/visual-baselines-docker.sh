#!/usr/bin/env bash
# Regenerates the public visual baselines locally in the same pinned Playwright
# Linux container that CI uses. Authenticated baselines come only from the
# `Visual baselines` workflow, because they need the visual-test credentials.
set -euo pipefail

image="mcr.microsoft.com/playwright:v1.64.1-noble"

dashboard_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$dashboard_dir/.." && pwd)"

pinned="$(node -p 'require(process.argv[1]).devDependencies["@playwright/test"]' "$dashboard_dir/package.json")"
if [ "$image" != "mcr.microsoft.com/playwright:v${pinned}-noble" ]; then
  echo "Update the image tag in $0 to match @playwright/test ${pinned}." >&2
  exit 1
fi

# node_modules and .next live in throwaway volumes so the host's own installs
# (often macOS binaries) are left alone; written files are handed back to you.
docker run --rm --ipc=host \
  -e CI=1 \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  -e DATABASE_URL=postgresql://test:test@127.0.0.1:1/test \
  -e NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=test \
  -v "$repo_root:/work" \
  -v /work/dashboard/node_modules \
  -v /work/dashboard/.next \
  -w /work/dashboard \
  "$image" \
  bash -c 'npm ci && npm run test:visual:update; status=$?; chown -R "$HOST_UID:$HOST_GID" tests/visual/__screenshots__ test-results 2>/dev/null || true; exit $status'
