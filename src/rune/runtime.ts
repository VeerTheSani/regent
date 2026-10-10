/**
 * src/rune/runtime.ts
 *
 * RUNE (Regent Unified Native Execution) - Full-Metal System Runtime.
 * Provides direct, zero-overhead primitives for Windows 11 host control:
 * ShellExecute URL/media launcher, desktop wallpaper, screenshot, notifications,
 * clipboard, process execution, HTTP fetching, and filesystem operations.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import spawn from "cross-spawn";
import { RuneCompiler } from "./compiler.js";

/**
 * Resolves paths with cross-platform environment variable expansion:
 * - Windows PowerShell: $env:VAR
 * - Windows CMD: %VAR%
 * - Unix / Bash: $VAR or ${VAR}
 * - Home shortcut: ~/ or ~
 */
export function expandEnvPath(rawPath: string): string {
  let p = rawPath.trim().replace(/^["']|["']$/g, "");
  // PowerShell env vars: $env:VAR
  p = p.replace(/\$env:([a-zA-Z0-9_]+)/gi, (_, v) => process.env[v] ?? "");
  // CMD env vars: %VAR%
  p = p.replace(/%([a-zA-Z0-9_]+)%/gi, (_, v) => process.env[v] ?? "");
  // Bash env vars: $VAR or ${VAR}
  p = p.replace(/\$\{?([a-zA-Z0-9_]+)\}?/g, (_, v) => process.env[v] ?? "");
  // Home directory tilde: ~
  if (p.startsWith("~")) {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    p = p.replace(/^~[/\\]?/, home ? `${home}\\` : "");
  }
  return resolve(p);
}

export class RuneRuntime {
  private compiler = new RuneCompiler();

  /**
   * Execute a shell command natively and return trimmed stdout.
   * Uses cross-spawn with proper Windows argument handling.
   */
  async exec(command: string): Promise<string> {
    return new Promise((res, rej) => {
      const isWin = process.platform === "win32";
      const shell = isWin ? process.env.ComSpec || "cmd.exe" : "/bin/bash";

      // On Windows, pass command directly to cmd /c without extra nested quotes
      const child = spawn(shell, ["/c", command], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsVerbatimArguments: true,
      });

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
   * Open any URL, file, or protocol using native Windows ShellExecute (zero quote escaping).
   */
  async openUrl(target: string): Promise<string> {
    const nativeCode = `
using System;
using System.Runtime.InteropServices;
public class WinShellOpen {
    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr ShellExecute(IntPtr hwnd, string lpOperation, string lpFile, string lpParameters, string lpDirectory, int nShowCmd);

    public static void Main(string[] args) {
        if (args.Length > 0) {
            ShellExecute(IntPtr.Zero, "open", args[0], null, null, 1);
            Console.WriteLine("OPENED:" + args[0]);
        }
    }
}
`;
    const cleanTarget = target.trim().replace(/^["']|["']$/g, "");
    return this.compiler.runNative(nativeCode, [cleanTarget]);
  }

  /**
   * Play media or music stream by query or URL.
   */
  async playMedia(queryOrUrl: string, speed?: string): Promise<string> {
    let url = queryOrUrl.trim().replace(/^["']|["']$/g, "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      const encoded = encodeURIComponent(queryOrUrl + (speed ? ` ${speed}` : ""));
      url = `https://www.youtube.com/results?search_query=${encoded}`;
    }
    return this.openUrl(url);
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
    const abs = expandEnvPath(imagePath);
    if (!existsSync(abs)) {
      throw new Error(`Wallpaper file not found: ${abs}`);
    }

    const nativeCode = `
using System;
using System.Runtime.InteropServices;
public class WinApiWallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
    public static void Main(string[] args) {
        if (args.Length > 0) {
            SystemParametersInfo(0x0014, 0, args[0], 0x01 | 0x02);
            Console.WriteLine("WALLPAPER_SET:" + args[0]);
        }
    }
}
`;
    await this.compiler.runNative(nativeCode, [abs]);
    return true;
  }

  /**
   * Capture a full desktop screenshot to a PNG file.
   */
  async screenshot(destPath: string): Promise<string> {
    const abs = expandEnvPath(destPath);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const nativeCode = `
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;
public class WinScreenSnap {
    public static void Main(string[] args) {
        if (args.Length > 0) {
            var b = SystemInformation.VirtualScreen;
            using (var bmp = new Bitmap(b.Width, b.Height)) {
                using (var g = Graphics.FromImage(bmp)) {
                    g.CopyFromScreen(b.Left, b.Top, 0, 0, b.Size);
                }
                bmp.Save(args[0], ImageFormat.Png);
            }
            Console.WriteLine("SAVED:" + args[0]);
        }
    }
}
`;
    await this.compiler.runNative(nativeCode, [abs]);
    return abs;
  }

  /**
   * Set or get Windows clipboard text.
   */
  async clipboard(text?: string): Promise<string> {
    if (text !== undefined) {
      const clean = text.trim().replace(/^["']|["']$/g, "");
      const b64 = Buffer.from(clean, "utf-8").toString("base64");
      const psCommand = `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard`;
      await this.exec(`powershell -NoProfile -Command "${psCommand}"`);
      return clean;
    }
    return this.exec('powershell -NoProfile -Command "Get-Clipboard"');
  }

  /**
   * Display a native Windows desktop toast notification.
   */
  async notify(title: string, message: string): Promise<void> {
    const cleanTitle = title.trim().replace(/^["']|["']$/g, "");
    const cleanMsg = message.trim().replace(/^["']|["']$/g, "");
    const psCommand = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
$texts = $template.GetElementsByTagName("text");
$texts[0].AppendChild($template.CreateTextNode("${cleanTitle.replace(/"/g, '`"')}")) | Out-Null;
$texts[1].AppendChild($template.CreateTextNode("${cleanMsg.replace(/"/g, '`"')}")) | Out-Null;
$toast = [Windows.UI.Notifications.ToastNotification]::new($template);
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Rune Agent").Show($toast);
`;
    try {
      await this.exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`);
    } catch {
      console.log(`[Rune Notify] ${cleanTitle}: ${cleanMsg}`);
    }
  }

  /**
   * Focus a desktop window by application title.
   */
  async focusWindow(titleSubstring: string): Promise<boolean> {
    const clean = titleSubstring.trim().replace(/^["']|["']$/g, "");
    const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@;
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*${clean}*" } | Select-Object -First 1;
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
    const abs = expandEnvPath(path);
    return readFileSync(abs, "utf-8");
  }

  /**
   * Write file content.
   */
  writeFile(path: string, content: string): void {
    const abs = expandEnvPath(path);
    const dir = dirname(abs);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(abs, content, "utf-8");
  }
}
