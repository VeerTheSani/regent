#!/usr/bin/env node
/**
 * bin/regent.js
 *
 * Global CLI Launcher for Regent.
 * Resolves the absolute path to regent.ts and executes via tsx,
 * allowing 'regent' commands to run from ANY directory on Windows.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const regentTs = join(__dirname, "regent.ts");

const child = spawn("npx", ["tsx", regentTs, ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
