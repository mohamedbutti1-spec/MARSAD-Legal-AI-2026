import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

/**
 * OpenAI provider — PLACEHOLDER.
 *
 * Reserved for future use cases where GPT-4o or o1 may be preferred, e.g.:
 *  - Code generation embedded in legal documents
 *  - Structured data extraction with function calling
 *  - High-volume summarisation at lower cost than Claude Opus
 *
 * Implementation checklist:
 *  [ ] Set OPENAI_API_KEY via Platform Settings → API Providers
 *  [ ] Install `openai` npm package
 *  [ ] Decide on model: gpt-4o | gpt-4o-mini | o1
 *  [ ] Wire into TASK_ROUTING for any new task types that prefer OpenAI
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly isAvailable: boolean;

  constructor(apiKey: string) {
    this.isAvailable = Boolean(apiKey);
  }

  async complete(_ctx: AITaskContext): Promise<AIProviderResult> {
    throw new Error(
      "OpenAIProvider is not yet implemented. " +
      "This provider is reserved for a future integration sprint.",
    );
  }
}
