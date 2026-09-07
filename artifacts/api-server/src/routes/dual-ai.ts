import { Router, type IRouter } from "express";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { aiAnalysisLimit } from "../middlewares/rateLimits.js";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";

const router: IRouter = Router();

/**
 * POST /ai/dual-review
 *
 * Sends the same legal question to OpenAI and Claude in parallel and returns
 * both answers side-by-side. API keys stay server-side and are resolved by
 * KeyService from OPENAI_API_KEY / ANTHROPIC_API_KEY.
 */
router.post(
  "/ai/dual-review",
  requireSupervisorOrOwner,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
    const systemPrompt =
      typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt.trim() : "";

    if (!question || question.length < 3) {
      res.status(400).json({ error: "question is required and must contain at least 3 characters." });
      return;
    }

    if (question.length > 20_000) {
      res.status(400).json({ error: "question is too long. Maximum 20,000 characters." });
      return;
    }

    try {
      const availability = await aiRouter.availability();
      const missing = [
        !availability.openai ? "OPENAI_API_KEY" : null,
        !availability.claude ? "ANTHROPIC_API_KEY" : null,
      ].filter(Boolean);

      if (missing.length > 0) {
        res.status(503).json({
          error: "Dual AI review is not fully configured.",
          missing,
          availability: {
            openai: availability.openai,
            claude: availability.claude,
          },
        });
        return;
      }

      const providers = await aiRouter.routeAll(TaskType.DUAL_REVIEW);
      const instruction =
        systemPrompt ||
        "You are a rigorous legal research assistant. Distinguish verified law from inference, identify uncertainty, and do not invent statutes, judgments, or citations. Answer in Arabic unless the user requests another language.";

      const settled = await Promise.allSettled(
        providers.map((provider) =>
          provider.complete({
            taskType: TaskType.DUAL_REVIEW,
            prompt: question,
            systemPrompt: instruction,
            maxTokens: 4000,
          }),
        ),
      );

      const results = settled.map((result, index) => {
        const providerName = providers[index]?.name ?? "unknown";
        if (result.status === "fulfilled") {
          return {
            ok: true as const,
            provider: result.value.provider,
            model: result.value.model,
            text: result.value.text,
            usage: result.value.usage,
          };
        }

        req.log.error(
          { err: result.reason, provider: providerName },
          "Dual AI provider failed",
        );
        return {
          ok: false as const,
          provider: providerName,
          error: "This AI provider could not complete the request.",
        };
      });

      const successful = results.filter((item) => item.ok).length;
      if (successful === 0) {
        res.status(502).json({ error: "Both AI providers failed.", results });
        return;
      }

      logAudit(req, "ai.dual-review", {
        details: {
          questionLength: question.length,
          successfulProviders: successful,
        },
      });

      res.json({
        question,
        results,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "Dual AI review failed");
      res.status(500).json({ error: "Dual AI review failed. Please try again." });
    }
  },
);

export default router;
