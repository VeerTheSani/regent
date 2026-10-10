/**
 * src/rune/interpreter.ts
 *
 * RUNE (Regent Unified Native Execution) Language Interpreter.
 * Evaluates compact, token-efficient commands designed for LLM agents
 * with full-metal host system control.
 */

import { RuneRuntime } from "./runtime.js";

export interface RuneContext {
  vars: Map<string, string>;
  lastOutput: string;
}

export class RuneInterpreter {
  private runtime = new RuneRuntime();
  private context: RuneContext = {
    vars: new Map(),
    lastOutput: "",
  };

  /**
   * Evaluate a full RUNE script or multi-line command string.
   */
  async run(script: string): Promise<string> {
    const lines = script
      .split(/[;\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    for (const line of lines) {
      await this.evalLine(line);
    }

    return this.context.lastOutput;
  }

  /**
   * Evaluate a single pipeline or statement.
   */
  async evalLine(line: string): Promise<string> {
    const pipeSegments = line.split("|").map((s) => s.trim());
    let currentInput = this.context.lastOutput;

    for (const segment of pipeSegments) {
      currentInput = await this.evalSegment(segment, currentInput);
    }

    this.context.lastOutput = currentInput;
    return currentInput;
  }

  private async evalSegment(segment: string, pipeInput: string): Promise<string> {
    // Interpolate variables: $var or ${var}
    const resolved = this.interpolate(segment, pipeInput);
    const tokens = this.tokenize(resolved);
    if (tokens.length === 0) return pipeInput;

    const cmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (cmd) {
      case "exec":
      case "sh":
      case "cmd": {
        const command = args.join(" ");
        const out = await this.runtime.exec(command);
        return out;
      }

      case "fetch":
      case "download": {
        // syntax: fetch <url> -> <dest>  or  fetch <url> <dest>
        let url = args[0];
        let dest = args[1];
        if (args.includes("->")) {
          const idx = args.indexOf("->");
          url = args.slice(0, idx).join(" ");
          dest = args.slice(idx + 1).join(" ");
        }
        if (!url || !dest) throw new Error("fetch requires: fetch <url> -> <dest>");
        const bytes = await this.runtime.fetchToFile(url, dest);
        return `Downloaded ${bytes} bytes to ${dest}`;
      }

      case "get": {
        const url = args.join(" ");
        return this.runtime.fetchText(url);
      }

      case "wallpaper": {
        const imagePath = args.join(" ");
        await this.runtime.setWallpaper(imagePath);
        return `Wallpaper updated to ${imagePath}`;
      }

      case "snap":
      case "screenshot": {
        const dest = args[0] ?? "screenshot.png";
        const saved = await this.runtime.screenshot(dest);
        return `Screenshot captured: ${saved}`;
      }

      case "notify": {
        const title = args[0] ?? "Notification";
        const msg = args.slice(1).join(" ") || "Rune Alert";
        await this.runtime.notify(title, msg);
        return `Notification sent: ${title}`;
      }

      case "clip": {
        if (args.length > 0) {
          return this.runtime.clipboard(args.join(" "));
        }
        return this.runtime.clipboard();
      }

      case "focus": {
        const target = args.join(" ");
        const focused = await this.runtime.focusWindow(target);
        return focused ? `Focused: ${target}` : `Window not found: ${target}`;
      }

      case "write": {
        const dest = args[0];
        const text = args.slice(1).join(" ");
        this.runtime.writeFile(dest, text);
        return `Wrote to ${dest}`;
      }

      case "read": {
        const src = args[0];
        return this.runtime.readFile(src);
      }

      case "print":
      case "echo": {
        const text = args.join(" ");
        console.log(text);
        return text;
      }

      case "let": {
        // syntax: let <name> = <value>
        const eqIdx = args.indexOf("=");
        if (eqIdx === -1) throw new Error("let requires: let <name> = <value>");
        const name = args.slice(0, eqIdx).join("").trim();
        const value = args
          .slice(eqIdx + 1)
          .join(" ")
          .trim();
        this.context.vars.set(name, value);
        return value;
      }

      default: {
        // Fallback: execute as shell command directly
        return this.runtime.exec(resolved);
      }
    }
  }

  private interpolate(text: string, pipeInput: string): string {
    let out = text.replace(/\$out/g, pipeInput);
    for (const [k, v] of this.context.vars.entries()) {
      out = out.replace(new RegExp(`\\$${k}\\b`, "g"), v);
      out = out.replace(new RegExp(`\\$\\{${k}\\}`, "g"), v);
    }
    return out;
  }

  private tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if ((c === '"' || c === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = c;
      } else if (c === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = "";
      } else if (c === " " && !inQuotes) {
        if (current.length > 0) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += c;
      }
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }
}
