/**
 * src/kernel/kill-switch.ts
 *
 * Emergency stop mechanism per 02 §4.
 * Checks for the presence of the STOP sentinel file.
 */

import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class KillSwitch {
  readonly path: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.path = customPath;
    } else {
      const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
      this.path = join(userHome, ".regent", "STOP");
    }
  }

  engaged(): boolean {
    return existsSync(this.path);
  }

  engage(): void {
    writeFileSync(this.path, `STOP engaged at ${new Date().toISOString()}\n`, "utf-8");
  }

  disengage(): void {
    if (existsSync(this.path)) {
      try {
        unlinkSync(this.path);
      } catch {}
    }
  }
}
