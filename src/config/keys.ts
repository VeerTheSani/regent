/**
 * src/config/keys.ts
 *
 * Resolves API keys and model configuration for Regent.
 * Automatically discovers OPENROUTER_API_KEY from environment or local Hermes configuration.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_MODEL = "google/gemini-3.8-flash";

export function getOpenRouterKey(): string | undefined {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  const userHome = process.env.USERPROFILE || process.env.HOME || "C:/Users/sanis";
  const hermesEnv = join(userHome, "AppData", "Local", "hermes", ".env");

  if (existsSync(hermesEnv)) {
    try {
      const content = readFileSync(hermesEnv, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("OPENROUTER_API_KEY=")) {
          return trimmed
            .split("=", 2)[1]
            .trim()
            .replace(/^["']|["']$/g, "");
        }
      }
    } catch {}
  }

  return undefined;
}

export function getActiveModel(): string {
  return process.env.REGENT_MODEL ?? DEFAULT_MODEL;
}
