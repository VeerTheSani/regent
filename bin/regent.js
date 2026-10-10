#!/usr/bin/env node
/**
 * bin/regent.js
 *
 * Global CLI Launcher for Regent.
 * Uses cross-spawn to resolve Windows wrappers safely without shell quote-stripping.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import spawn from "cross-spawn";

const __dirname = dirname(fileURLToPath(import.meta.url));
const regentTs = join(__dirname, "regent.ts");

const child = spawn("npx", ["tsx", regentTs, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
