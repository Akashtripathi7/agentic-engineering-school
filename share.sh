#!/usr/bin/env bash
# Serve the course on this machine and hand out a temporary public link.
# Usage: ./share.sh          (then send the printed https://…trycloudflare.com URL)
#        PORT=9000 ./share.sh
set -euo pipefail

PORT="${PORT:-8787}"
HERE="$(cd "$(dirname "$0")" && pwd)"

command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared is not installed. Install it with:  brew install cloudflared"
  exit 1
}

cleanup() { kill "${SERVER_PID:-}" "${TUNNEL_PID:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$HERE" >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
echo "Local:   http://localhost:$PORT"

LOG="$(mktemp)"
cloudflared tunnel --url "http://localhost:$PORT" --no-autoupdate >"$LOG" 2>&1 &
TUNNEL_PID=$!

printf 'Public:  '
URL=""
for _ in $(seq 1 40); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -n "$URL" ]; then
  echo "$URL"
  echo
  echo "Anyone with that link can read the course while this stays running."
  echo "The link is temporary and changes every time. Press Ctrl+C to stop sharing."
else
  echo "(failed)"
  echo "cloudflared did not report a URL. Its log is at: $LOG"
fi

wait "$TUNNEL_PID"
