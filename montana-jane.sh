#!/bin/sh
# Start Montana Jane.
#
#   sh montana-jane.sh
#
# Checks the key, installs deps on first run, picks a free port, waits for the
# server to answer, and opens the browser. Ctrl-C stops it.

set -eu

ROOT=$(cd "$(dirname "$0")" && pwd)
APP="$ROOT/web"

red()  { printf '\033[31m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
ok()   { printf '\033[32m%s\033[0m\n' "$1"; }
dim()  { printf '\033[2m%s\033[0m\n' "$1"; }

# --- the key ---------------------------------------------------------------
# Read from .env if it is not already exported. The app reads it server-side;
# it is never handed to the browser.
if [ -z "${FAL_KEY:-}" ] && [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1091
  . "$ROOT/.env"
fi

if [ -z "${FAL_KEY:-}" ]; then
  red "FAL_KEY is not set."
  echo
  echo "Put it in $ROOT/.env :"
  echo "    FAL_KEY=your-key-here"
  echo
  echo "Get one at https://fal.ai/dashboard/keys"
  exit 1
fi
export FAL_KEY

# --- prerequisites ---------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  red "node is not installed. Get it from https://nodejs.org (v20 or newer)."
  exit 1
fi

if [ ! -d "$APP" ]; then
  red "Cannot find the app at $APP"
  exit 1
fi

cd "$APP"

if [ ! -d node_modules ]; then
  warn "First run — installing dependencies (this takes a minute)…"
  npm install --no-fund --no-audit
fi

# --- credit ----------------------------------------------------------------
# Worth seeing before you start: the video model bills per second, with a
# 60-second minimum per session (roughly $1.20 every time you press Begin).
if command -v curl >/dev/null 2>&1; then
  BALANCE=$(curl -s -m 10 -H "Authorization: Key $FAL_KEY" \
    https://rest.fal.ai/billing/user_balance 2>/dev/null || true)
  case "$BALANCE" in
    ''|*[!0-9.]*) dim "fal credit: unavailable" ;;
    *)            ok  "fal credit: \$$BALANCE" ;;
  esac
fi

# --- pick a free port ------------------------------------------------------
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    nc -z 127.0.0.1 "$1" >/dev/null 2>&1
  fi
}

PORT=3000
while [ "$PORT" -lt 3020 ]; do
  if port_busy "$PORT"; then
    PORT=$((PORT + 1))
  else
    break
  fi
done

URL="http://localhost:$PORT"

# --- run -------------------------------------------------------------------
npm run dev -- --port "$PORT" &
SERVER=$!

# stop the server on Ctrl-C rather than orphaning it
trap 'kill "$SERVER" 2>/dev/null || true' INT TERM EXIT

printf 'Starting Montana Jane on %s ' "$URL"

TRIES=0
while [ "$TRIES" -lt 60 ]; do
  if curl -s -o /dev/null -m 2 "$URL" 2>/dev/null; then
    break
  fi
  # give up early if the server died on startup
  if ! kill -0 "$SERVER" 2>/dev/null; then
    echo
    red "The server stopped during startup. See the output above."
    exit 1
  fi
  printf '.'
  sleep 1
  TRIES=$((TRIES + 1))
done
echo

if [ "$TRIES" -ge 60 ]; then
  warn "Server is taking a long time. Try opening $URL yourself."
else
  ok "Ready — $URL"
  command -v open >/dev/null 2>&1 && open "$URL" || true
fi

echo
dim "Begin the scene   opens the live stream (billed per second, 60s minimum)"
dim "type + Send       an action, e.g. Walk to merchant"
dim "type + Say        dialogue — Jane speaks, an NPC answers"
dim "$URL/gallery      everything generated so far"
dim "Ctrl-C            stop"
echo

wait "$SERVER"
