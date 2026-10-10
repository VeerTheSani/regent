/**
 * test/unit/rune.test.ts
 *
 * Unit test suite for RUNE Language Interpreter & Runtime.
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RuneInterpreter } from "../../src/rune/interpreter.js";

describe("RUNE Language: Agent Native Control", () => {
  it("evaluates let variables and string interpolation", async () => {
    const interpreter = new RuneInterpreter();
    const script = `
let target = World
let greeting = Hello $target
print $greeting
`;
    const res = await interpreter.run(script);
    expect(res).toBe("Hello World");
  });

  it("executes system shell commands and pipes output into $out", async () => {
    const interpreter = new RuneInterpreter();
    const script = `
exec echo "RUNE_PIPELINE_OK"
`;
    const res = await interpreter.run(script);
    expect(res).toContain("RUNE_PIPELINE_OK");
  });

  it("handles fast native file write and read operations", async () => {
    const interpreter = new RuneInterpreter();
    const testFile = join(process.cwd(), "test", "fixtures", "rune-test-file.txt");

    const script = `
write ${testFile} "Agentic File Content 42"
read ${testFile}
`;
    const res = await interpreter.run(script);
    expect(res).toBe("Agentic File Content 42");
    expect(existsSync(testFile)).toBe(true);

    try {
      unlinkSync(testFile);
    } catch {}
  });

  it("manages system clipboard", async () => {
    const interpreter = new RuneInterpreter();
    const token = `RUNE_CLIP_${Date.now()}`;
    const res = await interpreter.run(`clip ${token}`);
    expect(res).toBe(token);
  });
});
