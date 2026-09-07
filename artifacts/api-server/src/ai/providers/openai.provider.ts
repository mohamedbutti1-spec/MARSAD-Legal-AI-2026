import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 150_000;

interface OpenAIResponsePayload {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text ?? "")
    .join("")
    .trim();
}

/**
 * OpenAI provider — wraps the Responses API.
 *
 * The API key is supplied by KeyService and is never exposed to the browser.
 * Default model: gpt-5.6-sol for high-quality professional/legal analysis.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly isAvailable: boolean;

  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-5.6-sol") {
    this.isAvailable = Boolean(apiKey);
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(ctx: AITaskContext): Promise<AIProviderResult> {
    if (!this.isAvailable) {
      throw new Error(
        "OpenAI provider is not available: OPENAI_API_KEY is not set. " +
        "Set the OPENAI_API_KEY environment variable on the server.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: ctx.prompt,
          max_output_tokens: ctx.maxTokens ?? 4096,
          ...(ctx.systemPrompt ? { instructions: ctx.systemPrompt } : {}),
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as OpenAIResponsePayload;

      if (!response.ok) {
        const detail = payload.error?.message || `HTTP ${response.status}`;
        throw new Error(`OpenAI API request failed: ${detail}`);
      }

      const text = extractOutputText(payload);
      if (!text) {
        throw new Error("OpenAI API returned no text output.");
      }

      return {
        text,
        provider: this.name,
        model: this.model,
        usage: {
          inputTokens: payload.usage?.input_tokens,
          outputTokens: payload.usage?.output_tokens,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
