#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing docker. Install Docker Desktop/Engine and re-run." >&2
  exit 1
fi

IMAGE="${ALLURE_BUNDLE_SIZE_DOCKER_IMAGE:-node:24-bookworm}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Measure inside container to avoid OS/environment drift.
docker run --rm -i \
  -v "${REPO_DIR}:/repo" \
  -w /repo \
  "${IMAGE}" \
  bash -lc '
    set -euo pipefail
    corepack enable >/dev/null 2>&1 || true
    yarn install --immutable
    yarn build
    node /repo/scripts/allure-bundle-size.mjs "$@"
  ' -- "$@"
