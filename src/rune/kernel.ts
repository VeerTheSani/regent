/**
 * src/rune/kernel.ts
 *
 * RUNE Low-Level Native Windows Kernel.
 * Direct Win32 hardware, process, window, display, and input generation primitives
 * compiled and executed via native CLR / C# P/Invoke.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import spawn from "cross-spawn";

export interface WindowInfo {
  hwnd: number;
  title: string;
  processId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memoryMb: number;
  mainWindow: string;
}

export class RuneKernel {
  private cacheDir: string;
  private cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";

  constructor(customCacheDir?: string) {
    const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
    this.cacheDir = customCacheDir ?? join(userHome, ".regent", "rune-bin");
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Run a PowerShell or native command with real-time capture.
   */
  async runPs(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", command], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout?.on("data", (d) => {
        out += d.toString();
      });
      child.stderr?.on("data", (d) => {
        err += d.toString();
      });
      child.on("close", (code) => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(err.trim() || out.trim() || `Exit code ${code}`));
      });
      child.on("error", reject);
    });
  }

  // --- HARDWARE: Mouse & Cursor ---

  async mouseMove(x: number, y: number): Promise<void> {
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinMouse {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
}
"@;
[WinMouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)});
`;
    await this.runPs(script);
  }

  async mouseClick(button: "left" | "right" | "middle" = "left"): Promise<void> {
    const downFlag = button === "right" ? 0x08 : button === "middle" ? 0x20 : 0x02;
    const upFlag = button === "right" ? 0x10 : button === "middle" ? 0x40 : 0x04;
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinClick {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
}
"@;
[WinClick]::mouse_event(${downFlag}, 0, 0, 0, 0);
Start-Sleep -Milliseconds 50;
[WinClick]::mouse_event(${upFlag}, 0, 0, 0, 0);
`;
    await this.runPs(script);
  }

  // --- HARDWARE: Keyboard Input ---

  async keyType(text: string): Promise<void> {
    const escaped = text.replace(/([+^%~{}()])/g, "{$1}").replace(/"/g, '`"');
    const script = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait("${escaped}");
`;
    await this.runPs(script);
  }

  async keyPress(keyName: string): Promise<void> {
    const script = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait("{${keyName}}");
`;
    await this.runPs(script);
  }

  // --- AUDIO: Beep and Volume ---

  async beep(freq = 800, durationMs = 250): Promise<void> {
    const script = `[console]::beep(${freq}, ${durationMs})`;
    await this.runPs(script);
  }

  // --- WINDOWS: HWND and Management ---

  async listWindows(): Promise<WindowInfo[]> {
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public class WinRect {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
"@;
Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | ForEach-Object {
    $rect = New-Object RECT;
    [void][WinRect]::GetWindowRect($_.MainWindowHandle, [ref]$rect);
    [PSCustomObject]@{
        hwnd = $_.MainWindowHandle.ToInt64();
        title = $_.MainWindowTitle;
        pid = $_.Id;
        x = $rect.Left;
        y = $rect.Top;
        width = $rect.Right - $rect.Left;
        height = $rect.Bottom - $rect.Top;
    }
} | ConvertTo-Json -Compress
`;
    try {
      const out = await this.runPs(script);
      if (!out) return [];
      const data = JSON.parse(out);
      const items = Array.isArray(data) ? data : [data];
      return items.filter((x): x is WindowInfo =>
        Boolean(x && typeof x === "object" && typeof x.hwnd === "number"),
      );
    } catch {
      return [];
    }
  }

  async setWindowRect(
    titlePattern: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<boolean> {
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinMove {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@;
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titlePattern}*" } | Select-Object -First 1;
if ($p) {
    [WinMove]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, ${x}, ${y}, ${width}, ${height}, 0x0040);
    Write-Output "MOVED";
} else {
    Write-Output "NOT_FOUND";
}
`;
    const out = await this.runPs(script);
    return out.includes("MOVED");
  }

  async closeWindow(titlePattern: string): Promise<boolean> {
    const script = `
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titlePattern}*" } | Select-Object -First 1;
if ($p) { $p.CloseMainWindow() | Out-Null; Write-Output "CLOSED" } else { Write-Output "NOT_FOUND" }
`;
    const out = await this.runPs(script);
    return out.includes("CLOSED");
  }

  // --- PROCESSES: List & Kill ---

  async listProcesses(limit = 30): Promise<ProcessInfo[]> {
    const script = `
Get-Process | Sort-Object -Descending WorkingSet64 | Select-Object -First ${limit} | ForEach-Object {
    [PSCustomObject]@{
        pid = $_.Id;
        name = $_.ProcessName;
        memoryMb = [math]::Round($_.WorkingSet64 / 1MB, 1);
        mainWindow = $_.MainWindowTitle;
    }
} | ConvertTo-Json -Compress
`;
    try {
      const out = await this.runPs(script);
      if (!out) return [];
      const data = JSON.parse(out);
      return Array.isArray(data) ? data : [data];
    } catch {
      return [];
    }
  }

  async killProcess(pidOrName: number | string): Promise<boolean> {
    const filter = typeof pidOrName === "number" ? `-Id ${pidOrName}` : `-Name "${pidOrName}"`;
    const script = `Stop-Process ${filter} -Force -ErrorAction SilentlyContinue; Write-Output "DONE"`;
    const out = await this.runPs(script);
    return out.includes("DONE");
  }

  // --- DISPLAY: Resolution and Monitors ---

  async getDisplayInfo(): Promise<{ width: number; height: number; monitors: number }> {
    const script = `
Add-Type -AssemblyName System.Windows.Forms;
$screens = [System.Windows.Forms.Screen]::AllScreens;
$v = [System.Windows.Forms.SystemInformation]::VirtualScreen;
[PSCustomObject]@{
    width = $v.Width;
    height = $v.Height;
    monitors = $screens.Count;
} | ConvertTo-Json -Compress
`;
    const out = await this.runPs(script);
    return JSON.parse(out);
  }
}
