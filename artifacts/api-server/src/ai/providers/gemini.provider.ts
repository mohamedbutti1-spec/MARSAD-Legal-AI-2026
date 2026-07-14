import { GoogleGenAI } from "@google/genai";
import type { AIProvider, AIProviderResult, AITaskContext } from "./interface";

/**
 * Gemini provider — Google's Generative AI API, used directly via
 * GEMINI_API_KEY (own key — no Replit AI Integrations proxy involved).
 *
 * Role in the multi-provider layer (see ai/tasks.ts TASK_ROUTING /
 * FALLBACK_PROVIDER):
 *  - Primary provider for fast, low-latency tasks (citation generation,
 *    quick document search).
 *  - Automatic fallback for Claude on long-form tasks (RAG assistant chat,
 *    literature review, constitutional assessment, document compare) when
 *    Anthropic is unavailable (billing outage, auth failure, timeout, etc.).
 *
 * Default model: gemini-2.0-flash — optimized for speed. Callers that need
 * Gemini to stand in for Claude on a heavy task may pass a stronger model
 * (e.g. "gemini-2.5-pro") via the constructor.
 */
const REQUEST_TIMEOUT_MS = 150_000;

/**
 * A Gemini API error is classified as "retryable" when it is a transient
 * network/server condition — safe to retry the exact same request.
 * Billing and auth failures are NOT retryable.
 */
export function isRetryableGeminiError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === undefined) return true; // network error / no HTTP response at all
  if (status === 408 || status === 409 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

/** Machine-readable error code so the frontend can pick the right Arabic copy. */
export type GeminiErrorCode =
  | "insufficient_credits"
  | "auth_failed"
  | "rate_limited"
  | "timeout"
  | "provider_error";

/** Classify a Gemini SDK error for user-facing messaging. */
export function classifyGeminiError(err: unknown): GeminiErrorCode {
  const status = (err as { status?: number })?.status;
  const message = String((err as { message?: string })?.message ?? "").toLowerCase();

  if (
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("resource_exhausted") ||
    status === 429 && message.includes("quota")
  ) {
    return "insufficient_credits";
  }
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (message.includes("timeout") || message.includes("deadline")) return "timeout";
  return "provider_error";
}

/** User-facing Arabic messages, one per error code — mirrors CLAUDE_ERROR_MESSAGES_AR. */
export const GEMINI_ERROR_MESSAGES_AR: Record<GeminiErrorCode, string> = {
  insufficient_credits:
    "تعذّر توليد الرد لأن خدمة Gemini غير متاحة حالياً على مستوى الحساب. تم إبلاغ فريق التشغيل. يرجى المحاولة لاحقاً.",
  auth_failed:
    "تعذّر الاتصال بخدمة Gemini بسبب خطأ في المصادقة. يرجى التواصل مع مسؤول النظام.",
  rate_limited:
    "تم تجاوز الحد المسموح من الطلبات على خدمة Gemini. يرجى الانتظار قليلاً ثم إعادة المحاولة.",
  timeout:
    "استغرق توليد الرد وقتاً أطول من المسموح عبر Gemini. يرجى إعادة المحاولة.",
  provider_error:
    "حدث خطأ غير متوقع أثناء توليد الرد عبر Gemini. يرجى إعادة المحاولة.",
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly isAvailable: boolean;

  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.isAvailable = Boolean(apiKey);
    this.client = new GoogleGenAI({ apiKey: apiKey || "__missing__" });
    this.model = model;
  }

  async complete(ctx: AITaskContext): Promise<AIProviderResult> {
    if (!this.isAvailable) {
      throw new Error(
        "Gemini provider is not available: GEMINI_API_KEY is not set. " +
        "Set the GEMINI_API_KEY environment variable.",
      );
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: ctx.prompt,
      config: {
        ...(ctx.systemPrompt ? { systemInstruction: ctx.systemPrompt } : {}),
        maxOutputTokens: ctx.maxTokens ?? 4096,
        ...(ctx.temperature !== undefined ? { temperature: ctx.temperature } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    const text = response.text ?? "";

    return {
      text,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount,
        outputTokens: response.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  /**
   * Stream raw text deltas from Gemini as they arrive.
   * Yields individual text chunks so callers can process output in real time
   * without waiting for the full generation to finish.
   */
  async *streamChunks(ctx: AITaskContext): AsyncGenerator<string> {
    if (!this.isAvailable) {
      throw new Error("Gemini provider is not available: GEMINI_API_KEY is not set.");
    }

    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: ctx.prompt,
      config: {
        ...(ctx.systemPrompt ? { systemInstruction: ctx.systemPrompt } : {}),
        maxOutputTokens: ctx.maxTokens ?? 4096,
        ...(ctx.temperature !== undefined ? { temperature: ctx.temperature } : {}),
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      },
    });

    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta) yield delta;
    }
  }
}
