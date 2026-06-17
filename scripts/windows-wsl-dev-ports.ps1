# Run in Windows PowerShell AS ADMINISTRATOR (not inside WSL).
# Forwards Windows hotspot/Wi-Fi IP -> WSL for TuneScribe backend (8000) and Metro (8081).
#
# Usage:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\windows-wsl-dev-ports.ps1
#   .\windows-wsl-dev-ports.ps1 -WifiIp 172.20.10.2

param(
    [string]$WifiIp = ''
)

$ErrorActionPreference = 'Stop'

function Get-WslIp {
    $raw = (wsl hostname -I 2>$null).Trim()
    if (-not $raw) {
        throw 'Could not read WSL IP. Is WSL running? Try: wsl hostname -I'
    }
    return ($raw -split '\s+')[0]
}

function Get-HotspotIPv4Addresses {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -like '172.20.10.*' -and
            $_.IPAddress -notlike '172.20.10.1'
        } |
        Sort-Object -Property InterfaceMetric |
        Select-Object -ExpandProperty IPAddress -Unique
}

function Get-DefaultWifiIPv4 {
    $all = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*' -and
            $_.IPAddress -notlike '172.17.*' -and
            $_.IPAddress -notlike '172.24.*'
        }

    $hotspot = Get-HotspotIPv4Addresses | Select-Object -First 1
    if ($hotspot) {
        return $hotspot
    }

    return $all |
        Where-Object {
            $_.IPAddress -like '192.168.*' -or
            $_.IPAddress -like '10.*'
        } |
        Sort-Object -Property InterfaceMetric |
        Select-Object -First 1 -ExpandProperty IPAddress
}

function Add-PortProxyRule {
    param(
        [string]$ListenAddress,
        [int]$Port,
        [string]$WslIp
    )

    netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=$ListenAddress 2>$null | Out-Null
    netsh interface portproxy add v4tov4 `
        listenport=$Port `
        listenaddress=$ListenAddress `
        connectport=$Port `
        connectaddress=$WslIp | Out-Null

    Write-Host "Port proxy: ${ListenAddress}:$Port -> ${WslIp}:$Port" -ForegroundColor Green
}

function Add-FirewallRule {
    param(
        [int]$Port
    )

    $ruleName = "TuneScribe Dev TCP $Port"

    foreach ($profile in @('Private', 'Public')) {
        $profileRuleName = "$ruleName ($profile)"
        Get-NetFirewallRule -DisplayName $profileRuleName -ErrorAction SilentlyContinue |
            Remove-NetFirewallRule -ErrorAction SilentlyContinue

        New-NetFirewallRule `
            -DisplayName $profileRuleName `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $Port `
            -Profile $profile `
            | Out-Null
    }

    Write-Host "Firewall rule added for TCP $Port" -ForegroundColor Green
}

if (-not $WifiIp) {
    $WifiIp = Get-DefaultWifiIPv4
}

if (-not $WifiIp) {
    throw 'Could not detect IP. Pass explicitly: .\windows-wsl-dev-ports.ps1 -WifiIp 172.20.10.2'
}

$wslIp = Get-WslIp
$listenAddresses = @($WifiIp) + @(Get-HotspotIPv4Addresses | Where-Object { $_ -ne $WifiIp })
$listenAddresses = $listenAddresses | Select-Object -Unique

Write-Host "Windows listen IP: $WifiIp" -ForegroundColor Cyan
Write-Host "WSL connect IP:    $wslIp" -ForegroundColor Cyan
if ($listenAddresses.Count -gt 1) {
    Write-Host "Also forwarding:   $($listenAddresses -join ', ')" -ForegroundColor Cyan
}

$ports = @(8000, 8081)

foreach ($port in $ports) {
    foreach ($listenAddress in $listenAddresses) {
        Add-PortProxyRule -ListenAddress $listenAddress -Port $port -WslIp $wslIp
    }

    try {
        Add-FirewallRule -Port $port
    }
    catch {
        Write-Warning "Could not add firewall rule for TCP $port (admin required): $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host 'Current portproxy rules:' -ForegroundColor Yellow
netsh interface portproxy show all

Write-Host ""
Write-Host 'Test from iPhone Safari:' -ForegroundColor Yellow
Write-Host "  http://${WifiIp}:8000/health"
Write-Host ""
Write-Host 'mobile/.env should be:' -ForegroundColor Yellow
Write-Host "  EXPO_PUBLIC_API_URL=http://${WifiIp}:8000"

$healthUrl = "http://${WifiIp}:8000/health"
Write-Host ""
Write-Host "Testing $healthUrl ..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    Write-Host "OK: $($response.Content)" -ForegroundColor Green
}
catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'If this failed, re-run this script in an elevated PowerShell window.' -ForegroundColor Red
    exit 1
}
