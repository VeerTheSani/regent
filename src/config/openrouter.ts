/**
 * src/config/openrouter.ts
 *
 * OpenRouter client helper for Gemini 3.8 and other models.
 */

import { DEFAULT_MODEL, getOpenRouterKey } from "./keys.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: {
    model?: string;
    apiKey?: string;
    responseFormatJson?: boolean;
    temperature?: number;
  } = {},
): Promise<ChatCompletionResponse> {
  const key = options.apiKey ?? getOpenRouterKey();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not available in environment or Hermes .env");
  }

  const model = options.model ?? DEFAULT_MODEL;

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.responseFormatJson) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://regent.local",
      "X-Title": "Regent Local Orchestrator",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter API error (HTTP ${res.status}): ${errorText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    text: content,
    model: data.model ?? model,
    usage: data.usage,
  };
}
