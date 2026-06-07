import { modelForTier } from "../model-router";
import type { LlmProvider, ProviderGenerateInput } from "../types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

function buildUserContent(input: ProviderGenerateInput): string {
  if (!input.jsonMode) return input.user;
  return `${input.user}\n\nRespond with valid JSON only. No markdown fences or commentary.`;
}

async function* parseAnthropicStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineBreak = buffer.indexOf("\n");
    while (lineBreak >= 0) {
      const line = buffer.slice(0, lineBreak).trim();
      buffer = buffer.slice(lineBreak + 1);

      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const text = event.delta.text;
            if (text) yield text;
          }
        } catch {
          /* ignore partial JSON */
        }
      }

      lineBreak = buffer.indexOf("\n");
    }
  }
}

export function createAnthropicProvider(apiKey: string): LlmProvider {
  return {
    name: "anthropic",

    async *streamText(input: ProviderGenerateInput) {
      const { model, maxOutputTokens } = modelForTier(input.tier, false);

      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: anthropicHeaders(apiKey),
        body: JSON.stringify({
          model,
          max_tokens: maxOutputTokens,
          stream: true,
          system: input.system,
          messages: [{ role: "user", content: buildUserContent(input) }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 300)}`);
      }
      if (!response.body) throw new Error("Anthropic API returned no body");

      yield* parseAnthropicStream(response.body);
    },

    async generateText(input: ProviderGenerateInput) {
      const { model, maxOutputTokens } = modelForTier(input.tier, false);

      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: anthropicHeaders(apiKey),
        body: JSON.stringify({
          model,
          max_tokens: maxOutputTokens,
          system: input.system,
          messages: [{ role: "user", content: buildUserContent(input) }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.find((b) => b.type === "text")?.text ?? "";
    },
  };
}
