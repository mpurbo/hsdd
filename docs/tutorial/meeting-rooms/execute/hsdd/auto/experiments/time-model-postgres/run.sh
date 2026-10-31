#!/bin/sh
# Runs probe.sql in a throwaway postgres:17-alpine container: no port, no volume, removed on exit.
# Run from the repository root: sh hsdd/auto/experiments/time-model-postgres/run.sh
set -eu
dir=$(dirname "$0")
docker run --rm -i --user postgres postgres:17-alpine sh -c '
  initdb -D /tmp/db -U postgres --auth=trust >/dev/null &&
  pg_ctl -D /tmp/db -w -o "-c listen_addresses=" -l /tmp/db.log start >/dev/null &&
  psql -X -U postgres -v ON_ERROR_STOP=0 -f - ;
  pg_ctl -D /tmp/db -w stop >/dev/null' < "$dir/probe.sql"
