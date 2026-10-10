/**
 * src/operator/notify.ts
 *
 * Notification dispatcher using Hermes messaging CLI per 11 §2.
 */

import spawn from "cross-spawn";

export type NotificationLevel = "info" | "needs_you" | "done" | "failed";

export interface NotificationOptions {
  channel?: string;
  imagePath?: string;
  quietHours?: string;
}

export function inQuietHours(quietHours = "23:00-08:00"): boolean {
  try {
    const [startStr, endStr] = quietHours.split("-");
    const [startH, startM = 0] = startStr.split(":").map(Number);
    const [endH, endM = 0] = endStr.split(":").map(Number);
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal > endTotal) {
      // Over midnight, e.g. 23:00 to 08:00
      return currentMin >= startTotal || currentMin < endTotal;
    }
    return currentMin >= startTotal && currentMin <= endTotal;
  } catch {
    return false;
  }
}

export const digestQueue: string[] = [];

export async function sendNotification(
  level: NotificationLevel,
  text: string,
  options: NotificationOptions = {},
): Promise<{ sent: boolean; queued: boolean; error?: string }> {
  const channel = options.channel ?? "telegram";

  if (level === "info" && inQuietHours(options.quietHours)) {
    digestQueue.push(`[${new Date().toLocaleTimeString()}] ${text}`);
    return { sent: false, queued: true };
  }

  const messageBody = options.imagePath ? `${text}\nMEDIA:${options.imagePath}` : text;

  // Hermes send execution
  return new Promise((resolve) => {
    const child = spawn("hermes", ["send", "-t", channel, "-q", "--file", "-"], {
      windowsHide: true,
    });

    let stderr = "";
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    if (child.stdin) {
      child.stdin.write(messageBody);
      child.stdin.end();
    }

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ sent: true, queued: false });
      } else {
        resolve({ sent: false, queued: false, error: stderr.trim() });
      }
    });

    child.on("error", (err) => {
      resolve({ sent: false, queued: false, error: err.message });
    });
  });
}
