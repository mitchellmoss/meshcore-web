#!/usr/bin/env bash
set -euo pipefail

# Start Vite dev server and the WebSocket serial bridge.
# Bridge is run as root (via sudo) using the same Node binary as the current user.
# Usage:
#   ./start.sh                        # HOST=0.0.0.0, PORT=5173, BRIDGE_PORT=8787
#   HOST=0.0.0.0 PORT=3000 ./start.sh # custom web port, default bridge port

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5173}"
BRIDGE_HOST="${MESHCORE_BRIDGE_HOST:-0.0.0.0}"
BRIDGE_PORT="${MESHCORE_BRIDGE_PORT:-8787}"
SERIAL_PORT="${MESHCORE_SERIAL_PORT:-/dev/ttyUSB0}"

# Use the same Node binary that the current user has in PATH (works with nvm, etc.).
NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "[start] Error: 'node' not found in PATH. Install Node.js first." >&2
  exit 1
fi

export MESHCORE_BRIDGE_HOST="$BRIDGE_HOST"
export MESHCORE_BRIDGE_PORT="$BRIDGE_PORT"
export MESHCORE_SERIAL_PORT="$SERIAL_PORT"

echo "[start] Web UI:   http://${HOST}:${PORT} (externally accessible if firewall allows)"
echo "[start] Bridge:    ws://${HOST}:${BRIDGE_PORT} -> serial ${SERIAL_PORT}"

# Always run the serial bridge as root so it can access /dev/ttyUSB0 regardless of groups.
echo "[start] Starting WebSocket serial bridge as root (sudo) using $NODE_BIN..."
MESHCORE_BRIDGE_HOST="$BRIDGE_HOST" \
     MESHCORE_BRIDGE_PORT="$BRIDGE_PORT" \
     MESHCORE_SERIAL_PORT="$SERIAL_PORT" \
     "$NODE_BIN" server/serial-bridge.js &
BRIDGE_PID=$!
echo "[start] Bridge PID (root): $BRIDGE_PID"

sleep 1

echo "[start] Starting Vite dev server as normal user..."
npm run dev -- --host "${HOST}" --port "${PORT}" &
DEV_PID=$!
echo "[start] Dev PID:          $DEV_PID"

echo "[start] Press Ctrl-C to stop both dev server and bridge."

cleanup() {
  echo "[start] Shutting down..."
  kill "$DEV_PID" 2>/dev/null || true
  kill "$BRIDGE_PID" 2>/dev/null || true
}

trap cleanup INT TERM

wait
