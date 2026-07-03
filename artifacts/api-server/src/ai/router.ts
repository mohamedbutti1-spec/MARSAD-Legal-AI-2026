/**
 * AIRouter — the single gateway through which all AI calls must pass.
 *
 * Responsibilities:
 *  - Map TaskType → ProviderName(s) via TASK_ROUTING
 *  - Resolve API keys (env → DB) via KeyService
 *  - Instantiate the correct AIProvider implementation
 *  - Throw descriptive errors when a provider is unavailable
 *
 * Usage:
 *   import { aiRouter, TaskType } from "../ai";
 *
 *   const provider = await aiRouter.routeFor(TaskType.DOCUMENT_SEARCH);
 *   const result   = await provider.complete({ taskType, prompt, maxTokens });
 *
 * For MIXED tasks (Claude + Perplexity), use routeAll():
 *   const [claude, perplexity] = await aiRouter.routeAll(TaskType.MIXED);
 */

import { TASK_ROUTING, TaskType, type ProviderName } from "./tasks";
import { getProviderKey } from "./key-service";
import { ClaudeProvider } from "./providers/claude.provider";
import { PerplexityProvider } from "./providers/perplexity.provider";
import { OpenAIProvider } from "./providers/openai.provider";
import type { AIProvider } from "./providers/interface";

export class AIRouter {
  /**
   * Route a single-provider task.
   * Throws if the task requires more than one provider (use routeAll instead).
   * Throws if the provider's API key is not configured.
   */
  async routeFor(task: TaskType): Promise<AIProvider> {
    const providers = TASK_ROUTING[task];
    if (providers.length > 1) {
      throw new Error(
        `Task "${task}" requires multiple providers. Use aiRouter.routeAll() instead.`,
      );
    }
    return this.buildProvider(providers[0]);
  }

  /**
   * Route a multi-provider task (e.g. MIXED).
   * Returns providers in the order defined in TASK_ROUTING.
   */
  async routeAll(task: TaskType): Promise<AIProvider[]> {
    const providerNames = TASK_ROUTING[task];
    return Promise.all(providerNames.map((name) => this.buildProvider(name)));
  }

  /**
   * Check which providers currently have keys configured.
   * Useful for health checks and the settings UI.
   */
  async availability(): Promise<Record<ProviderName, boolean>> {
    const [claude, perplexity, openai] = await Promise.all([
      getProviderKey("claude"),
      getProviderKey("perplexity"),
      getProviderKey("openai"),
    ]);
    return {
      claude:     Boolean(claude),
      perplexity: Boolean(perplexity),
      openai:     Boolean(openai),
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async buildProvider(name: ProviderName): Promise<AIProvider> {
    const key = await getProviderKey(name);

    switch (name) {
      case "claude":
        if (!key) {
          throw new Error(
            "Claude (Anthropic) API key is not configured. " +
            "Go to Platform Settings → API Providers and enter your ANTHROPIC_API_KEY, " +
            "or set the ANTHROPIC_API_KEY environment variable.",
          );
        }
        return new ClaudeProvider(key);

      case "perplexity":
        // The key check is deferred to the provider itself — it will throw a
        // "not implemented" error regardless. We still resolve the key so the
        // availability flag is accurate once the implementation lands.
        return new PerplexityProvider(key ?? "");

      case "openai":
        return new OpenAIProvider(key ?? "");

      default: {
        const _exhaustive: never = name;
        throw new Error(`Unknown provider: ${_exhaustive}`);
      }
    }
  }
}

/** Singleton instance — import this everywhere instead of `new AIRouter()`. */
export const aiRouter = new AIRouter();
