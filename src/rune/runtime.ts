/**
 * src/rune/runtime.ts
 *
 * RUNE (Regent Unified Native Execution) - Full-Metal System Runtime.
 * Provides direct, zero-overhead primitives for Windows 11 host control:
 * Desktop wallpaper, screenshot, notifications, clipboard, process execution,
 * HTTP fetching, and filesystem operations.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import spawn from "cross-spawn";

export class RuneRuntime {
  /**
   * Execute a shell command natively and return trimmed stdout.
   */
  async exec(command: string): Promise<string> {
    return new Promise((res, rej) => {
      const isWin = process.platform === "win32";
      const shell = isWin ? process.env.ComSpec || "cmd.exe" : "/bin/bash";
      const args = isWin ? ["/d", "/s", "/c", command] : ["-c", command];

      const child = spawn(shell, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          res(stdout.trim());
        } else {
          rej(new Error(`Command failed (exit ${code}): ${stderr.trim() || stdout.trim()}`));
        }
      });
      child.on("error", rej);
    });
  }

  /**
   * Download a remote resource directly to a local file.
   */
  async fetchToFile(url: string, destPath: string): Promise<number> {
    const absPath = resolve(destPath);
    const dir = dirname(absPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "RuneAgent/1.0" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(absPath, buffer);
    return buffer.length;
  }

  /**
   * Fetch URL and return text.
   */
  async fetchText(url: string): Promise<string> {
    const res = await fetch(url, { headers: { "User-Agent": "RuneAgent/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.text();
  }

  /**
   * Set Windows desktop wallpaper via Win32 SystemParametersInfo.
   */
  async setWallpaper(imagePath: string): Promise<boolean> {
    const abs = resolve(imagePath);
    if (!existsSync(abs)) {
      throw new Error(`Wallpaper file not found: ${abs}`);
    }

    const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinApiWallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@;
[WinApiWallpaper]::SystemParametersInfo(0x0014, 0, "${abs.replace(/\\/g, "\\\\")}", 0x01 -bor 0x02);
`;
    await this.exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`);
    return true;
  }

  /**
   * Capture a full desktop screenshot to a PNG file.
   */
  async screenshot(destPath: string): Promise<string> {
    const abs = resolve(destPath);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const psCommand = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen;
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size);
$bitmap.Save("${abs.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
`;
    await this.exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`);
    return abs;
  }

  /**
   * Set or get Windows clipboard text.
   */
  async clipboard(text?: string): Promise<string> {
    if (text !== undefined) {
      const b64 = Buffer.from(text, "utf-8").toString("base64");
      const psCommand = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
      await this.exec(`powershell -NoProfile -Command "${psCommand}"`);
      return text;
    }
    return this.exec('powershell -NoProfile -Command "Get-Clipboard"');
  }

  /**
   * Display a native Windows desktop toast notification.
   */
  async notify(title: string, message: string): Promise<void> {
    const psCommand = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
$texts = $template.GetElementsByTagName("text");
$texts[0].AppendChild($template.CreateTextNode("${title.replace(/"/g, '`"')}")) | Out-Null;
$texts[1].AppendChild($template.CreateTextNode("${message.replace(/"/g, '`"')}")) | Out-Null;
$toast = [Windows.UI.Notifications.ToastNotification]::new($template);
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Rune Agent").Show($toast);
`;
    try {
      await this.exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`);
    } catch {
      // Fallback to simple console beep/msg if toast runtime is disabled
      console.log(`[Rune Notify] ${title}: ${message}`);
    }
  }

  /**
   * Focus a desktop window by application title.
   */
  async focusWindow(titleSubstring: string): Promise<boolean> {
    const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@;
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titleSubstring}*" } | Select-Object -First 1;
if ($p) { [WinFocus]::SetForegroundWindow($p.MainWindowHandle); Write-Output "FOUND" } else { Write-Output "NOT_FOUND" }
`;
    const out = await this.exec(
      `powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`,
    );
    return out.includes("FOUND");
  }

  /**
   * Read file content.
   */
  readFile(path: string): string {
    return readFileSync(resolve(path), "utf-8");
  }

  /**
   * Write file content.
   */
  writeFile(path: string, content: string): void {
    const abs = resolve(path);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(abs, content, "utf-8");
  }
}
