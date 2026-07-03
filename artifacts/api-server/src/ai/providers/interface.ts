import type { TaskType } from "../tasks";

// ─── Request context ─────────────────────────────────────────────────────────

export interface AITaskContext {
  /** The task being performed — used for logging and provider selection. */
  taskType: TaskType;
  /** Fully-formed user prompt to send to the model. */
  prompt: string;
  /** Optional system-level instruction (provider-dependent). */
  systemPrompt?: string;
  /** Maximum tokens the model may generate. */
  maxTokens?: number;
  /** Sampling temperature (0-1). */
  temperature?: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface AIProviderResult {
  /** Raw text output from the model. */
  text: string;
  /** Provider name (e.g. "claude", "perplexity"). */
  provider: string;
  /** Exact model identifier used (e.g. "claude-opus-4-5"). */
  model: string;
  /** Token usage if reported by the provider. */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

// ─── Provider contract ────────────────────────────────────────────────────────

/**
 * Every AI provider must implement this interface.
 * Routes must never instantiate a concrete provider directly — they must
 * request a provider from the AIRouter.
 */
export interface AIProvider {
  /** Unique provider identifier. */
  readonly name: string;
  /** True when the provider has a valid API key and can accept requests. */
  readonly isAvailable: boolean;
  /**
   * Execute a single completion request and return the result.
   * Implementations are responsible for:
   *  - Stripping markdown code fences from JSON responses
   *  - Re-throwing with a descriptive error on API failure
   */
  complete(ctx: AITaskContext): Promise<AIProviderResult>;
  /**
   * Optional: stream raw text deltas as they arrive from the model.
   * Yields individual text chunks so callers can process output incrementally.
   * Providers that don't support streaming may omit this method.
   */
  streamChunks?(ctx: AITaskContext): AsyncGenerator<string>;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Strip markdown code fences that models sometimes wrap JSON responses in.
 * Handles both ` ```json\n...\n``` ` and ` ```\n...\n``` ` patterns.
 */
export function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

/**
 * Parse a JSON response from a model, falling back to `{ raw: text }` on
 * parse failure rather than throwing — so route handlers can decide how to
 * recover.
 */
export function parseModelJson<T = Record<string, unknown>>(
  text: string,
): { ok: true; data: T } | { ok: false; raw: string } {
  try {
    return { ok: true, data: JSON.parse(stripCodeFences(text)) as T };
  } catch {
    return { ok: false, raw: text };
  }
}
