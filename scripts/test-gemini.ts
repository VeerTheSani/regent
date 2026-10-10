/**
 * scripts/test-gemini.ts
 *
 * Live diagnostic test for google/gemini-3.8-flash across:
 * 1. Director interpretation (generates MissionBrief)
 * 2. T1 Fast Triage (checks plausibility)
 * 3. T2 Independent Judge (scores diff and produces Verdict)
 */

import { getOpenRouterKey } from "../src/config/keys.js";
import { callOpenRouter } from "../src/config/openrouter.js";

async function main() {
  console.log("=== Testing google/gemini-3.8-flash for Regent ===\n");

  const key = getOpenRouterKey();
  if (!key) {
    console.error("Error: OPENROUTER_API_KEY could not be found.");
    process.exit(1);
  }

  console.log("Found OpenRouter API Key: [Configured]");
  console.log("Target Model: google/gemini-3.8-flash\n");

  const results: Array<{ role: string; latencyMs: number; status: string; detail: string }> = [];

  // 1. Director Test
  {
    process.stdout.write("1. Testing Director (Mission Brief generation)... ");
    const start = Date.now();
    try {
      const res = await callOpenRouter(
        [
          {
            role: "system",
            content:
              "You are the Director of Regent. Output JSON matching: { goal: string, deliverableKind: string, definitionOfDone: [{ id: string, statement: string, verification: string }] }",
          },
          {
            role: "user",
            content: "Ticket: Build a string slugifier utility with unit tests.",
          },
        ],
        { model: "google/gemini-3.8-flash", responseFormatJson: true },
      );
      const latency = Date.now() - start;
      const parsed = JSON.parse(res.text);
      results.push({
        role: "Director",
        latencyMs: latency,
        status: "PASS",
        detail: `Goal: "${parsed.goal?.slice(0, 45)}...", DoDs: ${parsed.definitionOfDone?.length ?? 0}`,
      });
      console.log(`PASS (${latency}ms)`);
    } catch (err: unknown) {
      const latency = Date.now() - start;
      results.push({
        role: "Director",
        latencyMs: latency,
        status: "FAIL",
        detail: err instanceof Error ? err.message : String(err),
      });
      console.log(`FAIL (${latency}ms)`);
    }
  }

  // 2. T1 Fast Triage Test
  {
    process.stdout.write("2. Testing T1 Triage (Sanity check)... ");
    const start = Date.now();
    try {
      const res = await callOpenRouter(
        [
          {
            role: "system",
            content: "You are T1 Triage. Output JSON: { plausible: boolean, reason: string }",
          },
          {
            role: "user",
            content:
              "Diff modifies packages/core/slug.ts with a working implementation. All unit tests pass. Plausible?",
          },
        ],
        { model: "google/gemini-3.8-flash", responseFormatJson: true },
      );
      const latency = Date.now() - start;
      const parsed = JSON.parse(res.text);
      results.push({
        role: "T1 Triage",
        latencyMs: latency,
        status: "PASS",
        detail: `Plausible: ${parsed.plausible}, Reason: "${parsed.reason?.slice(0, 45)}..."`,
      });
      console.log(`PASS (${latency}ms)`);
    } catch (err: unknown) {
      const latency = Date.now() - start;
      results.push({
        role: "T1 Triage",
        latencyMs: latency,
        status: "FAIL",
        detail: err instanceof Error ? err.message : String(err),
      });
      console.log(`FAIL (${latency}ms)`);
    }
  }

  // 3. T2 Judge Test
  {
    process.stdout.write("3. Testing T2 Independent Judge (Scoring & Verdict)... ");
    const start = Date.now();
    try {
      const res = await callOpenRouter(
        [
          {
            role: "system",
            content:
              "You are the Regent Judge. Output JSON: { composite: number, decision: 'APPROVE'|'REVISE', summary: string }",
          },
          {
            role: "user",
            content:
              "Evaluate slugifier implementation: functions handle Unicode, trim punctuation, zero errors. Score 0-10.",
          },
        ],
        { model: "google/gemini-3.8-flash", responseFormatJson: true },
      );
      const latency = Date.now() - start;
      const parsed = JSON.parse(res.text);
      results.push({
        role: "T2 Judge",
        latencyMs: latency,
        status: "PASS",
        detail: `Composite: ${parsed.composite}/10, Decision: ${parsed.decision}, Summary: "${parsed.summary?.slice(0, 40)}..."`,
      });
      console.log(`PASS (${latency}ms)`);
    } catch (err: unknown) {
      const latency = Date.now() - start;
      results.push({
        role: "T2 Judge",
        latencyMs: latency,
        status: "FAIL",
        detail: err instanceof Error ? err.message : String(err),
      });
      console.log(`FAIL (${latency}ms)`);
    }
  }

  console.log("\n=== Gemini 3.8 Performance & Health Summary ===");
  console.table(results);
}

main().catch(console.error);
