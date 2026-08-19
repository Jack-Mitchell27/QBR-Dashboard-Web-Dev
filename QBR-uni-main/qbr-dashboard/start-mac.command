#!/bin/zsh
set -u

cd -- "$(dirname -- "$0")" || exit 1
PORT="${QBR_PORT:-5500}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to start the QBR Dashboard."
  echo "Install Python 3, then run this launcher again."
  read -r "?Press Enter to close..."
  exit 1
fi

python3 -m http.server "$PORT" >"${TMPDIR:-/tmp}/qbr-dashboard-$PORT.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

open "http://localhost:$PORT"
echo "QBR Dashboard is running at http://localhost:$PORT"
echo "Keep this window open. Press Ctrl+C to stop."
wait "$SERVER_PID"
