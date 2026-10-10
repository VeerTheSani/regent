# scripts/setup-chrome.ps1
# Launches Chrome for Regent over CDP with live window visibility.
# Use -Personal to attach directly to your real Chrome profile (all saved logins & cookies).

param(
    [switch]$Personal
)

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    Write-Error "Chrome executable not found at $chromePath"
    exit 1
}

if ($Personal) {
    $profilePath = "$env:LOCALAPPDATA\Google\Chrome\User Data"
    $running = Get-Process chrome -ErrorAction SilentlyContinue
    if ($running) {
        Write-Warning "Your personal Chrome is currently running."
        Write-Warning "Chrome's singleton lock requires closing running Chrome windows before starting with --remote-debugging-port=9222."
        Write-Host "Tip: Close Chrome windows and re-run: powershell -File scripts/setup-chrome.ps1 -Personal"
        exit 0
    }
    Write-Host "Launching your PERSONAL Chrome profile on port 9222 (with all your logins)..."
    Start-Process $chromePath -ArgumentList @(
        "--remote-debugging-port=9222",
        "--user-data-dir=$profilePath"
    )
} else {
    $profilePath = "$env:USERPROFILE\.regent\chrome-profile"
    Write-Host "Launching dedicated Regent Chrome profile on port 9222..."
    Start-Process $chromePath -ArgumentList @(
        "--remote-debugging-port=9222",
        "--user-data-dir=$profilePath",
        "--no-first-run",
        "--no-default-browser-check"
    )
}
