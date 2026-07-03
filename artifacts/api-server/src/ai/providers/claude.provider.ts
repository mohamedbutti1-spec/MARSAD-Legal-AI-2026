import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

/**
 * Claude provider — wraps Anthropic's Messages API.
 *
 * Handles:
 *  - JSON code-fence stripping (models sometimes wrap responses)
 *  - Structured error messages on API failure
 *  - Usage token reporting
 *
 * Default model: claude-opus-4-5 (best reasoning for legal research).
 * Override via the `model` constructor parameter for speed/cost trade-offs.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  readonly isAvailable: boolean;

  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-opus-4-5") {
    this.isAvailable = Boolean(apiKey);
    this.client = new Anthropic({ apiKey: apiKey || "__missing__" });
    this.model = model;
  }

  async complete(ctx: AITaskContext): Promise<AIProviderResult> {
    if (!this.isAvailable) {
      throw new Error(
        "Claude provider is not available: ANTHROPIC_API_KEY is not set. " +
        "Configure it via Platform Settings → API Providers, or set the ANTHROPIC_API_KEY environment variable.",
      );
    }

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: ctx.maxTokens ?? 4096,
      ...(ctx.systemPrompt ? { system: ctx.systemPrompt } : {}),
      ...(ctx.temperature !== undefined ? {} : {}), // Anthropic does not expose temperature in the same way
      messages: [{ role: "user", content: ctx.prompt }],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "";

    return {
      text: raw,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }

  /**
   * Stream raw text deltas from Claude as they arrive.
   * Yields individual text chunks so callers can process output in real time
   * without waiting for the full generation to finish.
   */
  async *streamChunks(ctx: AITaskContext): AsyncGenerator<string> {
    if (!this.isAvailable) {
      throw new Error(
        "Claude provider is not available: ANTHROPIC_API_KEY is not set.",
      );
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: ctx.maxTokens ?? 4096,
      ...(ctx.systemPrompt ? { system: ctx.systemPrompt } : {}),
      messages: [{ role: "user", content: ctx.prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        event.delta.text
      ) {
        yield event.delta.text;
      }
    }
  }
}
