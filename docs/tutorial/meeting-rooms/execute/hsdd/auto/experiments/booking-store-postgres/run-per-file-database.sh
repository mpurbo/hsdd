#!/bin/sh
# Like run.sh, for per-file-database.mjs only. Run from the repository root:
#   sh hsdd/auto/experiments/booking-store-postgres/run-per-file-database.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
if docker compose version >/dev/null 2>&1; then compose="docker compose"; else compose="docker-compose"; fi
$compose -p s16-booking-store -f "$dir/compose.yaml" up -d --wait >/dev/null 2>&1
TZ=Asia/Kolkata node "$dir/per-file-database.mjs" || status=$?
$compose -p s16-booking-store -f "$dir/compose.yaml" down -v >/dev/null 2>&1
exit "${status:-0}"
