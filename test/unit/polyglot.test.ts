/**
 * test/unit/polyglot.test.ts
 *
 * TDD test suite for Polyglot Execution Sandbox.
 * Verifies zero-escaping execution across Python, Node.js, PowerShell, and Native C#.
 */

import { describe, expect, it } from "vitest";
import { PolyglotEngine } from "../../src/engine/polyglot.js";

describe("Polyglot Execution Sandbox", () => {
  const engine = new PolyglotEngine();

  it("executes Python code via stdin without quoting issues", async () => {
    const code = `
import sys
# Complex multiline code with nested quotes and backslashes
s = 'Hello from Python! "Quotes" and \\'single quotes\\' and \\n newlines.'
print("PY_RESULT:" + str(len(s)))
`;
    const res = await engine.runPython(code);
    expect(res.ok).toBe(true);
    expect(res.stdout).toContain("PY_RESULT:63");
  });

  it("executes Node.js code with structured JSON return", async () => {
    const code = `
const data = { status: "ok", value: 42 * 2 };
console.log(JSON.stringify(data));
`;
    const res = await engine.runNode(code);
    expect(res.ok).toBe(true);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.value).toBe(84);
  });

  it("executes PowerShell code via Base64 EncodedCommand with zero escaping bugs", async () => {
    const script = `
$val = 40 + 2
Write-Output "PS_RESULT:$val"
`;
    const res = await engine.runPowerShell(script);
    expect(res.ok).toBe(true);
    expect(res.stdout).toContain("PS_RESULT:42");
  });

  it("executes Native Win32 C# code via Roslyn JIT", async () => {
    const csharpCode = `
using System;
public class PolyTest {
    public static void Main(string[] args) {
        Console.WriteLine("NATIVE_CSHARP_OK:100");
    }
}
`;
    const res = await engine.runNative(csharpCode);
    expect(res.ok).toBe(true);
    expect(res.stdout).toContain("NATIVE_CSHARP_OK:100");
  });
});
