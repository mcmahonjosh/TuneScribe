#!/usr/bin/env bash
# Fix TuneScribe phone -> WSL backend connectivity on Windows + WSL2.
# Run from repo root: bash scripts/fix-dev-network.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PS_SCRIPT='\\wsl.localhost\Ubuntu\home\jhm359\TuneScribe\scripts\windows-wsl-dev-ports.ps1'
METRO_PORT="${METRO_PORT:-8081}"
WSL_IP="$(hostname -I | awk '{print $1}')"
WIN_HOTSPOT_IP="$(powershell.exe -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.IPAddress -like '172.20.10.*' -and \$_.IPAddress -ne '172.20.10.1' } | Select-Object -First 1 -ExpandProperty IPAddress)" 2>/dev/null | tr -d '\r')"

echo "WSL IP:          $WSL_IP"
echo "Windows hotspot: ${WIN_HOTSPOT_IP:-unknown}"

backend_ok=false
metro_ok=false

if curl -fsS -m 3 "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
  echo "Backend in WSL:  OK (http://127.0.0.1:8000/health)"
  backend_ok=true
else
  echo "Backend in WSL:  NOT RUNNING"
  echo "Start it with:"
  echo "  cd backend && source .venv/bin/activate"
  echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
fi

if [[ -n "$WIN_HOTSPOT_IP" ]]; then
  if powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://${WIN_HOTSPOT_IP}:8000/health' -UseBasicParsing -TimeoutSec 5).Content; exit 0 } catch { exit 1 }" >/dev/null 2>&1; then
    echo "Backend forward: OK (http://${WIN_HOTSPOT_IP}:8000/health)"
  else
    echo "Backend forward: BROKEN"
  fi

  if powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://${WIN_HOTSPOT_IP}:${METRO_PORT}/status' -UseBasicParsing -TimeoutSec 5).Content; exit 0 } catch { exit 1 }" >/dev/null 2>&1; then
    echo "Metro forward:   OK (http://${WIN_HOTSPOT_IP}:${METRO_PORT}/status)"
    metro_ok=true
  else
    echo "Metro forward:   BROKEN (phone needs port ${METRO_PORT}, not 8082)"
  fi
fi

write_mobile_env() {
  local env_file="$ROOT_DIR/mobile/.env"
  local api_line="EXPO_PUBLIC_API_URL=http://${WIN_HOTSPOT_IP}:8000"
  if [[ -f "$env_file" ]]; then
    if grep -q '^EXPO_PUBLIC_API_URL=' "$env_file"; then
      sed -i "s|^EXPO_PUBLIC_API_URL=.*|${api_line}|" "$env_file"
    else
      printf '\n%s\n' "$api_line" >> "$env_file"
    fi
    echo "Updated mobile/.env -> ${api_line}"
  else
    echo "mobile/.env:"
    echo "  ${api_line}"
  fi
}

if [[ -n "$WIN_HOTSPOT_IP" ]] && $backend_ok; then
  if powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://${WIN_HOTSPOT_IP}:8000/health' -UseBasicParsing -TimeoutSec 5).Content; exit 0 } catch { exit 1 }" >/dev/null 2>&1 && $metro_ok; then
    echo ""
    write_mobile_env
    echo ""
    echo "Restart Metro so the app picks up the new API URL:"
    echo "  bash scripts/start-metro-hotspot.sh -c"
    exit 0
  fi
fi

if [[ -z "$WIN_HOTSPOT_IP" ]]; then
  echo "No hotspot IP detected."
  exit 1
fi

echo ""
echo "Refreshing Windows port proxy (UAC prompt may appear)..."

powershell.exe -NoProfile -Command "
  \$script = '$PS_SCRIPT'
  if (-not (Test-Path \$script)) {
    \$script = '$ROOT_DIR/scripts/windows-wsl-dev-ports.ps1' -replace '/', '\\'
    \$script = '\\\\wsl.localhost\\Ubuntu' + (\$script -replace '^/home/jhm359', '')
  }
  Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', \$script
  )
"

backend_forward_ok=false
metro_forward_ok=false

if powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://${WIN_HOTSPOT_IP}:8000/health' -UseBasicParsing -TimeoutSec 5).Content; exit 0 } catch { exit 1 }" >/dev/null 2>&1; then
  backend_forward_ok=true
fi

if powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://${WIN_HOTSPOT_IP}:${METRO_PORT}/status' -UseBasicParsing -TimeoutSec 5).Content; exit 0 } catch { exit 1 }" >/dev/null 2>&1; then
  metro_forward_ok=true
fi

if $backend_forward_ok; then
  echo "Backend forward: OK"
fi

if $metro_forward_ok; then
  echo "Metro forward:   OK"
else
  echo "Metro forward:   still broken — start Metro on port ${METRO_PORT}, then re-run this script"
fi

if $backend_forward_ok; then
  echo ""
  write_mobile_env
  echo ""
  echo "Restart Metro so the app picks up the new API URL:"
  echo "  bash scripts/start-metro-hotspot.sh -c"
  exit 0
fi

echo "Still failing. Open Windows PowerShell as Administrator and run:"
echo "  cd \\\\wsl.localhost\\Ubuntu\\home\\jhm359\\TuneScribe\\scripts"
echo "  .\\windows-wsl-dev-ports.ps1"
exit 1
