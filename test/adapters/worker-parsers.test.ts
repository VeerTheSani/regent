/**
 * test/adapters/worker-parsers.test.ts
 *
 * Acceptance tests for M2: verifies adapter parsers against real recorded probe fixtures.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClaudeStreamLine } from "../../src/workers/claude-code.js";
import { parseHermesOutput } from "../../src/workers/hermes.js";

const FIXTURES_DIR = join(process.cwd(), "test", "fixtures", "probes");

describe("M2: Worker Adapters & Fixture Parsers", () => {
  it("P1 fixture: parses Claude stream-json events correctly", () => {
    const fixturePath = join(FIXTURES_DIR, "p1-claude-stream-json.jsonl");
    expect(existsSync(fixturePath)).toBe(true);

    const lines = readFileSync(fixturePath, "utf-8").trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2);

    let foundInit = false;
    let foundResult = false;
    let foundCost = false;
    let sessionId = "";

    for (const line of lines) {
      const parsed = parseClaudeStreamLine(line);
      if (!parsed) continue;

      if (parsed.type === "system" && parsed.subtype === "init") {
        foundInit = true;
        sessionId = parsed.session_id ?? "";
      }
      if (parsed.type === "result") {
        foundResult = true;
        if (typeof parsed.total_cost_usd === "number") {
          foundCost = true;
        }
      }
    }

    expect(foundInit).toBe(true);
    expect(sessionId).toMatch(/^[0-9a-f-]+$/i);
    expect(foundResult).toBe(true);
    expect(foundCost).toBe(true);
  });

  it("P2 fixture: correctly detects budget exhaustion", () => {
    const fixturePath = join(FIXTURES_DIR, "p2-claude-budget-exhaustion.jsonl");
    expect(existsSync(fixturePath)).toBe(true);

    const lines = readFileSync(fixturePath, "utf-8").trim().split("\n");
    let budgetExhausted = false;

    for (const line of lines) {
      const parsed = parseClaudeStreamLine(line);
      if (!parsed) continue;

      if (parsed.type === "result") {
        if (parsed.subtype?.includes("budget") || parsed.terminal_reason?.includes("budget")) {
          budgetExhausted = true;
        }
      }
    }

    expect(budgetExhausted).toBe(true);
  });

  it("P3 fixture: verifies headless resume session parsed", () => {
    const fixturePath = join(FIXTURES_DIR, "p3-claude-resume.jsonl");
    expect(existsSync(fixturePath)).toBe(true);

    const lines = readFileSync(fixturePath, "utf-8").trim().split("\n");
    let hasResult = false;

    for (const line of lines) {
      const parsed = parseClaudeStreamLine(line);
      if (parsed?.type === "result" && parsed.result) {
        hasResult = true;
      }
    }

    expect(hasResult).toBe(true);
  });

  it("P6 fixture: extracts Hermes sessionId and clean final response", () => {
    const fixturePath = join(FIXTURES_DIR, "p6-hermes-chat-oneshot.txt");
    expect(existsSync(fixturePath)).toBe(true);

    const content = readFileSync(fixturePath, "utf-8");
    const [stdoutPart, stderrPart] = content.split("STDERR:\n");

    const stdout = stdoutPart.replace("STDOUT:\n", "").trim();
    const stderr = stderrPart ? stderrPart.trim() : "";

    const { sessionId, finalText } = parseHermesOutput(stdout, stderr);

    expect(sessionId).toBeDefined();
    expect(sessionId).toMatch(/^2026\d{4}_\d{6}_[0-9a-f]+$/);
    expect(finalText).toContain("P6_CONFIRMED");
  });

  it("P7 fixture: parses Hermes approval hardline block", () => {
    const fixturePath = join(FIXTURES_DIR, "p7-hermes-approval-non-tty.json");
    expect(existsSync(fixturePath)).toBe(true);

    const data = JSON.parse(readFileSync(fixturePath, "utf-8"));
    expect(data.verdict).toBe("hardline-deny");
    expect(data.exit_code).toBe(3);
  });

  it("P13 fixture: parses Chrome CDP endpoint response", () => {
    const fixturePath = join(FIXTURES_DIR, "p13-chrome-cdp.json");
    expect(existsSync(fixturePath)).toBe(true);

    const data = JSON.parse(readFileSync(fixturePath, "utf-8"));
    expect(data.Browser).toBeDefined();
    expect(data.Browser).toContain("Chrome");
  });

  it("P14 & P15 fixtures: saved placeholders exist and document gating", () => {
    const p14Path = join(FIXTURES_DIR, "p14-openrouter-jev.json");
    const p15Path = join(FIXTURES_DIR, "p15-anthropic-opus-parse.json");

    expect(existsSync(p14Path)).toBe(true);
    expect(existsSync(p15Path)).toBe(true);

    const p14 = JSON.parse(readFileSync(p14Path, "utf-8"));
    const p15 = JSON.parse(readFileSync(p15Path, "utf-8"));

    expect(p14.gated).toBe(true);
    expect(p15.gated).toBe(true);
  });
});
