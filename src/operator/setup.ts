/**
 * src/operator/setup.ts
 *
 * Operator onboarding and initialization per 13 §3, 14 M7.
 * Writes ~/.regent/config.yaml, charter.yaml, and operator.yaml.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { getOrCreateBridgeToken } from "../bridge/server.js";

export interface SetupOptions {
  interactive?: boolean;
  channel?: string;
  maxJobUsd?: number;
}

export function runSetup(options: SetupOptions = {}): {
  configPath: string;
  charterPath: string;
  operatorPath: string;
} {
  const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
  const regentDir = join(userHome, ".regent");
  if (!existsSync(regentDir)) {
    mkdirSync(regentDir, { recursive: true });
  }

  // Ensure token exists
  getOrCreateBridgeToken();

  // 1. config.yaml
  const configPath = join(regentDir, "config.yaml");
  const config = {
    version: 1,
    daemon: { port: 7780, bridgePort: 7781, maxParallelWorkers: 3 },
    paths: { jobs: join(regentDir, "jobs"), worktreesSuffix: ".regent-worktrees" },
    models: {
      director: {
        provider: "anthropic",
        model: "claude-opus-5-5",
        effortPlan: "high",
        effortDecide: "medium",
      },
      judge: { backend: "api", provider: "anthropic", model: "claude-opus-5-5", effort: "high" },
      fast: { primary: "typesafe/jev-router", fallback: "claude-haiku-5-5", timeoutMs: 8000 },
    },
    budgets: {
      job: { maxUsd: options.maxJobUsd ?? 20, maxHours: 6 },
      contract: { maxAttempts: 6 },
      attempt: { maxUsd: 3, maxMinutes: 45, stallMinutes: 8 },
    },
  };
  writeFileSync(configPath, stringify(config), "utf-8");

  // 2. charter.yaml
  const charterPath = join(regentDir, "charter.yaml");
  const defaultCharterPath = join(process.cwd(), "charter", "charter.default.yaml");
  if (existsSync(defaultCharterPath)) {
    const rawCharter = readFileSync(defaultCharterPath, "utf-8");
    writeFileSync(charterPath, rawCharter, "utf-8");
  } else {
    writeFileSync(charterPath, "version: 1\nrules: []\n", "utf-8");
  }

  // 3. operator.yaml
  const operatorPath = join(regentDir, "operator.yaml");
  const operator = {
    version: 1,
    channel: options.channel ?? "telegram",
    quietHours: "23:00-08:00",
    taste: {
      style: "concise, direct, analogy-first",
      tools: ["vitest", "biome", "tsx"],
    },
  };
  writeFileSync(operatorPath, stringify(operator), "utf-8");

  return { configPath, charterPath, operatorPath };
}
