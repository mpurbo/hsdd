#!/bin/sh
# Starts a throwaway PostgreSQL 17 with Compose (whichever of `docker compose` and `docker-compose`
# exists), runs probe.mjs under TZ=Asia/Kolkata, then removes the database.
# Run from the repository root, after `npm --prefix hsdd/auto/experiments/booking-store-postgres install`:
#   sh hsdd/auto/experiments/booking-store-postgres/run.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
if docker compose version >/dev/null 2>&1; then compose="docker compose"; else compose="docker-compose"; fi
echo "0. compose command: $compose ($($compose version 2>&1 | head -1))"
$compose -p s16-booking-store -f "$dir/compose.yaml" up -d --wait >/dev/null 2>&1
echo "   up -d --wait returned once the healthcheck passed"
TZ=Asia/Kolkata node "$dir/probe.mjs" || status=$?
$compose -p s16-booking-store -f "$dir/compose.yaml" down -v >/dev/null 2>&1
exit "${status:-0}"
