#!/usr/bin/env node
/**
 * bin/rune.ts
 *
 * Command-line runner for RUNE (Regent Unified Native Execution) scripts.
 * Usage:
 *   npx tsx bin/rune.ts script.rune
 *   npx tsx bin/rune.ts -e "wallpaper path/to/image.png"
 */

import { existsSync, readFileSync } from "node:fs";
import { RuneInterpreter } from "../src/rune/interpreter.js";

async function main() {
  const args = process.argv.slice(2);
  const interpreter = new RuneInterpreter();

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(`
RUNE - Regent Unified Native Execution Language
Lightweight, zero-overhead language for autonomous AI agents.

Usage:
  rune <script.rune>         Run a RUNE script file
  rune -e "<code>"           Execute inline RUNE code
  rune --version             Show version

Primitives:
  exec <cmd>                 Execute system shell command
  fetch <url> -> <dest>      Download web file directly to disk
  wallpaper <path>           Set active Windows desktop wallpaper
  snap [dest.png]            Capture full desktop screenshot
  notify <title> <message>   Display native Windows toast notification
  clip [text]                Get or set system clipboard
  focus <window_title>       Focus native desktop application window
  read <file> | write <file> Fast filesystem I/O
  let <var> = <expr>         Variable declaration
`);
    process.exit(0);
  }

  if (args[0] === "-e" && args[1]) {
    try {
      const result = await interpreter.run(args[1]);
      if (result) console.log(result);
    } catch (err: unknown) {
      console.error(`Rune Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return;
  }

  const filePath = args[0];
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const code = readFileSync(filePath, "utf-8");
  try {
    const result = await interpreter.run(code);
    if (result) console.log(result);
  } catch (err: unknown) {
    console.error(`Rune Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch(console.error);
