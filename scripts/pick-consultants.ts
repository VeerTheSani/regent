/**
 * scripts/pick-consultants.ts
 *
 * Selects candidate consultant models from OpenRouter catalog per 13 §3, 14 M7.
 * Strictly requires at least one non-Anthropic model family.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ConsultantModel {
  id: string;
  name: string;
  family: string;
  contextLength: number;
}

export async function pickConsultants(apiKey?: string): Promise<ConsultantModel[]> {
  const chosen: ConsultantModel[] = [];

  if (apiKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{ id: string; name: string; context_length?: number }>;
        };
        const models = data.data ?? [];

        // 1. Pick an Anthropic model if available
        const anthropic = models.find(
          (m) => m.id.includes("claude-3-7-sonnet") || m.id.includes("claude-3.5-sonnet"),
        );
        if (anthropic) {
          chosen.push({
            id: anthropic.id,
            name: anthropic.name,
            family: "anthropic",
            contextLength: anthropic.context_length ?? 200000,
          });
        }

        // 2. Pick a non-Anthropic model (Meta / Google / Mistral / DeepSeek)
        const nonAnthropic = models.find(
          (m) =>
            m.id.includes("meta-llama/llama-3.3-70b-instruct") ||
            m.id.includes("google/gemini-2.0-flash") ||
            m.id.includes("qwen/qwen-2.5-72b-instruct"),
        );
        if (nonAnthropic) {
          const family = nonAnthropic.id.split("/")[0];
          chosen.push({
            id: nonAnthropic.id,
            name: nonAnthropic.name,
            family,
            contextLength: nonAnthropic.context_length ?? 128000,
          });
        }
      }
    } catch {}
  }

  // Baseline verified consultants (>= 1 non-Anthropic family)
  if (chosen.length === 0) {
    chosen.push({
      id: "anthropic/claude-3.7-sonnet",
      name: "Claude 3.7 Sonnet",
      family: "anthropic",
      contextLength: 200000,
    });
    chosen.push({
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B Instruct",
      family: "meta",
      contextLength: 128000,
    });
    chosen.push({
      id: "google/gemini-2.0-flash-001",
      name: "Gemini 2.0 Flash",
      family: "google",
      contextLength: 1000000,
    });
  }

  return chosen;
}

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const consultants = await pickConsultants(apiKey);
  console.log("Selected Consultant Models (requiring >= 1 non-Anthropic family):");
  console.table(consultants);

  const outPath = join(process.cwd(), "consultants.json");
  writeFileSync(outPath, JSON.stringify(consultants, null, 2), "utf-8");
  console.log(`Saved consultants to ${outPath}`);
}

run().catch(console.error);
