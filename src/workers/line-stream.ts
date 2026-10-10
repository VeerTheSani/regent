/**
 * src/workers/line-stream.ts
 *
 * Stream transformer that splits incoming byte streams into individual lines.
 */

import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";

export class LineStream extends EventEmitter {
  private buffer = "";

  constructor(source: Readable) {
    super();

    source.on("data", (chunk: Buffer | string) => {
      this.buffer += chunk.toString("utf-8");
      const lines = this.buffer.split(/\r?\n/);
      // The last element is either a partial line or empty string
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        this.emit("line", line);
      }
    });

    source.on("end", () => {
      if (this.buffer.length > 0) {
        this.emit("line", this.buffer);
        this.buffer = "";
      }
      this.emit("end");
    });

    source.on("error", (err) => {
      this.emit("error", err);
    });
  }
}
