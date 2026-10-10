/**
 * src/workers/attempt-log.ts
 *
 * Writes all raw stdout/stderr lines from a worker attempt to worker.log on disk.
 */

import { type WriteStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class AttemptLog {
  readonly path: string;
  private stream: WriteStream;

  constructor(filePath: string) {
    this.path = filePath;
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.stream = createWriteStream(filePath, { flags: "a", encoding: "utf-8" });
  }

  write(line: string): void {
    this.stream.write(`${line}\n`);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(() => resolve());
    });
  }
}
