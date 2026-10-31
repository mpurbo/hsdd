#!/usr/bin/env bash
# The phase's Verification for simple-login.backend.7, by hand with curl.
# Usage: b7-verify.sh <worktree> <log-dir>. Prints the transcript; tokens are shortened.
set -u
WT="$1"; LOGS="$2"
cd "$WT" || exit 2
COMPOSE=(docker-compose -f backend/compose.yaml)
PSQL=("${COMPOSE[@]}" exec -T postgres psql -U meeting_rooms -At)
BASE=http://127.0.0.1:3000
FROM=2026-11-01T17:00:00.000Z   # start of 2 November in Jakarta (UTC+7)
TO=2026-11-02T17:00:00.000Z     # start of 3 November in Jakarta
START=2026-11-02T03:00:00.000Z  # 10:00 in Jakarta
END=2026-11-02T04:00:00.000Z    # 11:00 in Jakarta

say() { printf '\n$ %s\n' "$*"; }
short() { printf '%s...' "${1:0:6}"; }
SERVER_PID=""
start_service() { # $1 log file, $2.. env assignments
  local log="$1"; shift
  env "$@" npm --prefix backend start > "$log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 100); do grep -q 'Server listening' "$log" && return 0; sleep 0.1; done
  echo "service did not start:"; cat "$log"; return 1
}
stop_service() { pkill -TERM -P "$SERVER_PID" 2>/dev/null; kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; sleep 0.5; }
sign_in() { curl -s -X POST "$1/api/login" -H 'content-type: application/json' -d '{"username":"ayu","password":"sunrise-42"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token))'; }
call() { # method url token [body]: prints status line and body
  local m="$1" u="$2" t="$3" b="${4:-}"
  if [ -n "$b" ]; then
    curl -s -o "$LOGS/body" -w '%{http_code}' -X "$m" "$u" -H "authorization: Bearer $t" -H 'content-type: application/json' -d "$b" > "$LOGS/code"
  else
    curl -s -o "$LOGS/body" -w '%{http_code}' -X "$m" "$u" -H "authorization: Bearer $t" > "$LOGS/code"
  fi
  printf 'HTTP %s, body bytes %s\n' "$(cat "$LOGS/code")" "$(wc -c < "$LOGS/body" | tr -d ' ')"
  cat "$LOGS/body"; echo
}

echo "# simple-login.backend.7 Verification transcript, HEAD $(git rev-parse --short HEAD), $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# Real clock $(date -u +%Y-%m-%dT%H:%M:%SZ); the next day in Jakarta is 2026-11-02, from $FROM to $TO."
say npm --prefix backend run db:up
npm --prefix backend run db:up 2>&1 | tail -2
say "psql -d meeting_rooms -c \"SELECT to_regclass('public.booking')\"   (before the first start)"
"${PSQL[@]}" -d meeting_rooms -c "SELECT coalesce(to_regclass('public.booking')::text, '(none)')"

say "npm --prefix backend start   (PORT and DATABASE_URL unset: port 3000, the meeting_rooms database)"
start_service "$LOGS/service-1.log" || exit 1
grep -o '"msg":"Server listening[^"]*"' "$LOGS/service-1.log"
T1=$(sign_in "$BASE"); say "POST /api/login as ayu -> token $(short "$T1")"
say "GET /api/rooms?from=$FROM&to=$TO"
call GET "$BASE/api/rooms?from=$FROM&to=$TO" "$T1"
say "POST /api/bookings Merapi $START to $END"
call POST "$BASE/api/bookings" "$T1" "{\"roomId\":\"merapi\",\"start\":\"$START\",\"end\":\"$END\",\"title\":\"Verification booking\"}"
ID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).id)' "$LOGS/body")
say "POST /api/bookings Merapi 2026-11-02T03:30:00.000Z to 2026-11-02T04:30:00.000Z (overlaps)"
call POST "$BASE/api/bookings" "$T1" '{"roomId":"merapi","start":"2026-11-02T03:30:00.000Z","end":"2026-11-02T04:30:00.000Z","title":"Overlapping"}'

say "restart: stop the service, npm --prefix backend start again"
stop_service
start_service "$LOGS/service-2.log" || exit 1
grep -o '"msg":"Server listening[^"]*"' "$LOGS/service-2.log"
say "GET /api/me/bookings with the old token $(short "$T1")"
call GET "$BASE/api/me/bookings" "$T1"
T2=$(sign_in "$BASE"); say "POST /api/login as ayu again -> token $(short "$T2")"
say "GET /api/me/bookings"
call GET "$BASE/api/me/bookings" "$T2"
echo "(the 201's id was $ID)"
say "DELETE /api/bookings/$ID"
call DELETE "$BASE/api/bookings/$ID" "$T2"
say "GET /api/me/bookings"
call GET "$BASE/api/me/bookings" "$T2"
stop_service

say "psql -d meeting_rooms -c 'CREATE DATABASE b7_verify_empty'"
"${PSQL[@]}" -d meeting_rooms -c "CREATE DATABASE b7_verify_empty"
say "psql -d b7_verify_empty -c '\\dt'   (before the start)"
"${PSQL[@]}" -d b7_verify_empty -c '\dt' ; echo "(no relations)"
say "DATABASE_URL=postgres://meeting_rooms:***@127.0.0.1:55432/b7_verify_empty npm --prefix backend start"
start_service "$LOGS/service-3.log" DATABASE_URL=postgres://meeting_rooms:meeting_rooms@127.0.0.1:55432/b7_verify_empty || exit 1
T3=$(sign_in "$BASE"); say "POST /api/login as ayu -> token $(short "$T3")"
say "GET /api/rooms?from=$FROM&to=$TO"
call GET "$BASE/api/rooms?from=$FROM&to=$TO" "$T3"
say "psql -d b7_verify_empty -c '\\dt'   (the service running)"
"${PSQL[@]}" -d b7_verify_empty -c '\dt'
stop_service
say "psql -d meeting_rooms -c 'DROP DATABASE b7_verify_empty'"
"${PSQL[@]}" -d meeting_rooms -c "DROP DATABASE b7_verify_empty"

say "DATABASE_URL=postgres://meeting_rooms:***@127.0.0.1:1/meeting_rooms npm --prefix backend start   (nothing listens on port 1)"
DATABASE_URL=postgres://meeting_rooms:meeting_rooms@127.0.0.1:1/meeting_rooms npm --prefix backend start > "$LOGS/service-4.log" 2>&1; echo "exit $?"
grep -v '^>' "$LOGS/service-4.log" | grep -v '^$'

say "grep the four service logs for the password, the tokens and the database URL"
for f in "$LOGS"/service-*.log; do
  hits=$(grep -c -e 'sunrise-42' -e "$T1" -e "$T2" -e "$T3" -e 'meeting_rooms:meeting_rooms' "$f")
  echo "$(basename "$f"): $hits matching lines"
done
say "psql -l (databases left on the Compose service)"
"${PSQL[@]}" -d meeting_rooms -c "SELECT datname FROM pg_database ORDER BY 1"
