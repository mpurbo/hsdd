#!/bin/sh
# Run from the repository root:
#   npm --prefix hsdd/auto/experiments/backend-start-empty-database install
#   sh hsdd/auto/experiments/backend-start-empty-database/run.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
if docker compose version >/dev/null 2>&1; then compose="docker compose"; else compose="docker-compose"; fi
$compose -p s24-start-empty -f "$dir/compose.yaml" up -d --wait >/dev/null 2>&1
TZ=Asia/Kolkata node "$dir/probe.mjs" || status=$?
$compose -p s24-start-empty -f "$dir/compose.yaml" down -v >/dev/null 2>&1
exit "${status:-0}"
