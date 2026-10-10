/**
 * test/unit/rune.test.ts
 *
 * Comprehensive test suite for RUNE 2.0:
 * - Dynamic capability synthesis (def)
 * - Native C/C# Win32 compilation (native)
 * - Control flow (loops, conditionals)
 * - Low-level hardware & process kernel
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RuneInterpreter } from "../../src/rune/interpreter.js";

describe("RUNE 2.0: Full Freedom Engine", () => {
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

  it("supports dynamic capability definition (def) on the fly", async () => {
    const interpreter = new RuneInterpreter();
    const script = `
def greet target {
  print "Greetings, $target!"
}

greet Operator
`;
    const res = await interpreter.run(script);
    expect(res).toBe("Greetings, Operator!");
  });

  it("supports control flow: loop and if conditionals", async () => {
    const interpreter = new RuneInterpreter();
    const script = `
let counter = 0
loop 3 {
  let counter = $i
}

if $counter {
  print "Counter reached $counter"
} else {
  print "Failed"
}
`;
    const res = await interpreter.run(script);
    expect(res).toBe("Counter reached 2");
  });

  it("inspects running processes via low-level kernel (sys.ps)", async () => {
    const interpreter = new RuneInterpreter();
    const res = await interpreter.run("sys.ps 5");
    const procs = JSON.parse(res);
    expect(Array.isArray(procs)).toBe(true);
    expect(procs.length).toBeGreaterThan(0);
    expect(procs[0].pid).toBeDefined();
    expect(procs[0].name).toBeDefined();
  });

  it("compiles and executes native Win32 C/C# code in real time (native)", async () => {
    const interpreter = new RuneInterpreter();
    const script = `
native add_numbers {
  using System;
  public class AddProg {
    public static void Main(string[] args) {
      int a = int.Parse(args[0]);
      int b = int.Parse(args[1]);
      Console.WriteLine("NATIVE_SUM:" + (a + b));
    }
  }
}

add_numbers 19 23
`;
    const res = await interpreter.run(script);
    expect(res).toBe("NATIVE_SUM:42");
  });
});
