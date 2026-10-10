# scripts/setup-chrome.ps1
# Launches dedicated Chrome instance for Regent over CDP

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profilePath = "$env:USERPROFILE\.regent\chrome-profile"

if (-not (Test-Path $chromePath)) {
    Write-Error "Chrome executable not found at $chromePath"
    exit 1
}

Write-Host "Launching Regent Chrome instance on port 9222..."
Start-Process $chromePath -ArgumentList @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$profilePath",
    "--no-first-run",
    "--no-default-browser-check"
)
