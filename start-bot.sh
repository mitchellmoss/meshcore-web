#!/usr/bin/env bash
set -euo pipefail

# Starts the MeshCore headless bot/bridge as root
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SERIAL_PORT="${MESHCORE_SERIAL_PORT:-/dev/ttyUSB0}"
BRIDGE_PORT="${MESHCORE_BRIDGE_PORT:-8787}"

# Find node binary in current user's path
NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "Error: 'node' not found in PATH." >&2
  exit 1
fi

echo "[bot] Starting headless bot on $SERIAL_PORT (using sudo)..."
sudo MESHCORE_SERIAL_PORT="$SERIAL_PORT" \
     MESHCORE_BRIDGE_PORT="$BRIDGE_PORT" \
     "$NODE_BIN" server/serial-bridge.js
