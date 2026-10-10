# src/evidence/capture-window.ps1 — usage: -Title "<window title substring>" -Out <png> (or omit -Title for full virtual screen)
param(
    [string]$Title = "",
    [Parameter(Mandatory=$true)][string]$Out
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

try {
    [W]::SetProcessDPIAware() | Out-Null
} catch {}

if ($Title) {
    $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Title*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $p) {
        Write-Error "window not found: $Title"
        exit 2
    }
    $r = New-Object W+RECT
    [W]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
    $w = [Math]::Max(1, $r.Right - $r.Left)
    $h = [Math]::Max(1, $r.Bottom - $r.Top)

    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    $ok = [W]::PrintWindow($p.MainWindowHandle, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    if (-not $ok) {
        [W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
        Start-Sleep -Milliseconds 300
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
        $g.Dispose()
    }
} else {
    Add-Type -AssemblyName System.Windows.Forms
    $v = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $w = [Math]::Max(1, $v.Width)
    $h = [Math]::Max(1, $v.Height)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($v.Left, $v.Top, 0, 0, $bmp.Size)
    $g.Dispose()
}

$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Captured to $Out"
