/**
 * src/config/openrouter.ts
 *
 * OpenRouter client helper for Gemini 3.8 and other models.
 * Supports standard text messages and multimodal base64 vision requests.
 */

import { DEFAULT_MODEL, getOpenRouterKey } from "./keys.js";

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContentPart[];
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

/**
 * Sends a desktop screenshot to Gemini 3.8 to verify if a user's goal is visibly satisfied.
 */
export async function callOpenRouterWithVision(
  prompt: string,
  base64Png: string,
  options: { model?: string; apiKey?: string } = {},
): Promise<{ text: string; verified?: boolean; explanation?: string }> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Png}`,
          },
        },
      ],
    },
  ];

  const res = await callOpenRouter(messages, {
    ...options,
    responseFormatJson: true,
  });

  try {
    const parsed = JSON.parse(res.text);
    return {
      text: res.text,
      verified: Boolean(parsed.verified),
      explanation: parsed.explanation ?? res.text,
    };
  } catch {
    const isAffirmative =
      res.text.toLowerCase().includes("true") ||
      res.text.toLowerCase().includes("yes") ||
      res.text.toLowerCase().includes("verified");
    return {
      text: res.text,
      verified: isAffirmative,
      explanation: res.text,
    };
  }
}
