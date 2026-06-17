#!/usr/bin/env bash
# Start Expo Metro for iPhone hotspot + WSL (no ngrok tunnel).
# Run from repo root: bash scripts/start-metro-hotspot.sh
# Pass -c to clear Metro cache.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METRO_PORT=8081
CLEAR_CACHE=""

for arg in "$@"; do
  if [[ "$arg" == "-c" ]]; then
    CLEAR_CACHE="-c"
  fi
done

detect_hotspot_ip() {
  powershell.exe -NoProfile -Command "
    (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        \$_.IPAddress -like '172.20.10.*' -and
        \$_.IPAddress -ne '172.20.10.1'
      } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress)
  " 2>/dev/null | tr -d '\r'
}

stop_listener_on_port() {
  local port="$1"
  local pids

  pids="$(ss -tlnp 2>/dev/null | grep ":${port} " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Stopping stale process on port ${port}..."
  while read -r pid; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done <<< "$pids"
  sleep 1
}

WIN_IP="$(detect_hotspot_ip)"

if [[ -z "$WIN_IP" ]]; then
  echo "No iPhone hotspot IP found (172.20.10.x)."
  echo "Connect PC to the phone hotspot, or run: npm run start:tunnel"
  exit 1
fi

echo "Refreshing Windows port proxy for backend (8000) and Metro (${METRO_PORT})..."
if ! bash "$ROOT_DIR/scripts/fix-dev-network.sh"; then
  echo "Warning: port proxy refresh had issues. Metro may still work if rules are current."
fi

stop_listener_on_port "$METRO_PORT"

export REACT_NATIVE_PACKAGER_HOSTNAME="$WIN_IP"
export RCT_METRO_PORT="$METRO_PORT"

echo ""
echo "Starting Metro in LAN mode on port ${METRO_PORT} (do not switch to 8082)."
echo "  Packager URL: http://${WIN_IP}:${METRO_PORT}"
echo "  Backend URL:  http://${WIN_IP}:8000"
echo ""
echo "Scan the QR code in the TuneScribe dev app after Metro starts."
echo ""

cd "$ROOT_DIR/mobile"
exec npx expo start --dev-client --host lan --port "$METRO_PORT" $CLEAR_CACHE
