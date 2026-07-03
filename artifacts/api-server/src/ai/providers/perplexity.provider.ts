import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

/**
 * Perplexity provider — PLACEHOLDER.
 *
 * This provider is intentionally not yet implemented.
 * It will be integrated after explicit architectural approval.
 *
 * When implemented it will use Perplexity's Sonar API (OpenAI-compatible
 * endpoint at https://api.perplexity.ai) for live web search tasks:
 *  - LIVE_WEB_SEARCH
 *  - LATEST_LEGISLATION
 *  - COURT_DECISIONS
 *  - LEGAL_NEWS
 *
 * Implementation checklist (do not remove — used during integration sprint):
 *  [ ] Set PERPLEXITY_API_KEY via Platform Settings → API Providers
 *  [ ] Install `openai` SDK (Perplexity uses an OpenAI-compatible endpoint)
 *  [ ] Choose model: "sonar" (fast) or "sonar-pro" (deep research)
 *  [ ] Handle `citations` array in Perplexity responses (not in OpenAI spec)
 *  [ ] Map citation URLs back to legal source metadata
 *  [ ] Add retry logic for 429 / rate-limit responses
 *  [ ] Write integration test against the live Perplexity API
 */
export class PerplexityProvider implements AIProvider {
  readonly name = "perplexity";
  readonly isAvailable: boolean;

  // Future: private client: OpenAI (pointed at Perplexity's base URL)
  // private client: OpenAI;
  // private model: string;

  constructor(apiKey: string, model = "sonar-pro") {
    // When the key is present the provider is technically "available",
    // but complete() still throws until the implementation is filled in.
    this.isAvailable = Boolean(apiKey);
    void model; // suppress unused-variable warning until implemented
  }

  async complete(_ctx: AITaskContext): Promise<AIProviderResult> {
    throw new Error(
      "PerplexityProvider is not yet implemented. " +
      "Perplexity integration is pending architectural approval. " +
      "All live-web and legislation tasks will be available after the integration sprint.",
    );
  }
}
