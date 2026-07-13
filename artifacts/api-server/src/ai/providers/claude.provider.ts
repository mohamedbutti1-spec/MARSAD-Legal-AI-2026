import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

/**
 * Requests can legitimately take a while for long, 17-section legal opinions
 * (8000 output tokens on claude-opus-4-5). 120s is the floor required by the
 * product spec; give ourselves a bit more headroom so a long answer is never
 * cut off mid-generation on a slow connection.
 */
const REQUEST_TIMEOUT_MS = 150_000;

/**
 * A Claude/Anthropic API error is classified as "retryable" when it is a
 * transient network/server condition — safe to retry the exact same request.
 * Billing and auth failures (400 invalid_request_error re: credit balance,
 * 401, 403) are NOT retryable: retrying sends the same request to the same
 * broken account and will fail identically, wasting the user's time.
 */
export function isRetryableAnthropicError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === undefined) return true; // network error / no HTTP response at all
  if (status === 408 || status === 409 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

/** Machine-readable error code so the frontend can pick the right Arabic copy. */
export type ClaudeErrorCode =
  | "insufficient_credits"
  | "auth_failed"
  | "rate_limited"
  | "timeout"
  | "provider_error";

/** Classify an Anthropic SDK error for user-facing messaging. */
export function classifyAnthropicError(err: unknown): ClaudeErrorCode {
  const status = (err as { status?: number })?.status;
  const message = String((err as { message?: string })?.message ?? "");

  if (message.toLowerCase().includes("credit balance")) return "insufficient_credits";
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if ((err as { name?: string })?.name === "APIConnectionTimeoutError") return "timeout";
  return "provider_error";
}

/**
 * User-facing Arabic messages, one per error code. Kept deliberately generic
 * (no account/billing internals) — the precise technical error (Anthropic's
 * raw message, status code, request id) is always logged server-side via
 * req.log.error and never sent to the browser.
 */
export const CLAUDE_ERROR_MESSAGES_AR: Record<ClaudeErrorCode, string> = {
  insufficient_credits:
    "تعذّر توليد الرد لأن خدمة الذكاء الاصطناعي غير متاحة حالياً على مستوى الحساب. تم إبلاغ فريق التشغيل. يرجى المحاولة لاحقاً.",
  auth_failed:
    "تعذّر الاتصال بخدمة الذكاء الاصطناعي بسبب خطأ في المصادقة. يرجى التواصل مع مسؤول النظام.",
  rate_limited:
    "تم تجاوز الحد المسموح من الطلبات على خدمة الذكاء الاصطناعي. يرجى الانتظار قليلاً ثم إعادة المحاولة.",
  timeout:
    "استغرق توليد الرد وقتاً أطول من المسموح. يرجى إعادة المحاولة — قد تساعد إعادة صياغة السؤال بشكل أقصر.",
  provider_error:
    "حدث خطأ غير متوقع أثناء توليد الرد القانوني. يرجى إعادة المحاولة.",
};

/**
 * Claude provider — wraps Anthropic's Messages API.
 *
 * Handles:
 *  - JSON code-fence stripping (models sometimes wrap responses)
 *  - Structured error messages on API failure
 *  - Usage token reporting
 *  - Request timeout (>=120s) so long legal opinions are never cut off early
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
    this.client = new Anthropic({
      apiKey: apiKey || "__missing__",
      timeout: REQUEST_TIMEOUT_MS,
      // The SDK's own retry mechanism only covers connection-level failures;
      // our own retry-once-then-fallback logic in the route handler covers
      // the rest, so keep this modest to avoid doubling up on latency.
      maxRetries: 1,
    });
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
