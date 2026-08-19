#!/usr/bin/env sh
set -u

cd -- "$(dirname -- "$0")" || exit 1
PORT="${QBR_PORT:-5500}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to start the QBR Dashboard."
  exit 1
fi

python3 -m http.server "$PORT" >"${TMPDIR:-/tmp}/qbr-dashboard-$PORT.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT" >/dev/null 2>&1 &
else
  echo "Open http://localhost:$PORT in your browser."
fi

echo "QBR Dashboard is running at http://localhost:$PORT"
echo "Keep this terminal open. Press Ctrl+C to stop."
wait "$SERVER_PID"
