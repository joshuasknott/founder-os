import { internal } from "./_generated/api";

// =========================================================================
// Multi-Tier AI Routing Engine (Self-Healing & Auto-Backoff)
//
// Tier 1: o4-mini          (OpenAI)  — Sentinel & Routing
// Tier 2: gemini-3-flash   (Google)  — Fast Execution
// Tier 3: gpt-5.2-codex    (OpenAI)  — Core Engine
// Tier 4: o3               (OpenAI)  — Deep Escalation
// =========================================================================

const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

type TierConfig = {
  model: string;
  provider: "openai" | "google";
};

const TIER_MAP: Record<number, TierConfig> = {
  1: { model: "o4-mini", provider: "openai" },
  2: { model: "gemini-3-flash", provider: "google" },
  3: { model: "gpt-5.2", provider: "openai" },
  4: { model: "o3", provider: "openai" },
};

/**
 * Custom error handler to properly intercept 429 Status Codes and
 * interface with the engine.
 */
async function callOpenAI(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  ctx?: any,
  taskId?: any
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return `[AI Router] OPENAI_API_KEY not configured.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      if (ctx && taskId) {
        let retryCount = 0;
        try {
           const task = await ctx.runQuery(internal.engine.getTaskById, { taskId });
           if (task) retryCount = task.retryCount ?? 0;
        } catch (e) { }

        // Exponential backoff calculation
        const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 30000);
        await ctx.scheduler.runAfter(backoffMs, internal.engine.executeTask, { taskId });
        return `[AI Router] 429 Rate Limit hit. Task rescheduled with exponential backoff (${backoffMs}ms).`;
      }
      throw new Error(`OpenAI Rate Limit 429. ${data?.error?.message}`);
    }

    if (response.status === 404 && model !== OPENAI_FALLBACK_MODEL) {
      return callOpenAI(OPENAI_FALLBACK_MODEL, systemPrompt, userPrompt, ctx, taskId);
    }
    return `[AI Router] Error (${response.status}): ${data?.error?.message ?? "Unknown"}`;
  }

  return data.choices?.[0]?.message?.content ?? `[AI Router] No content.`;
}

async function callGemini(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  ctx?: any,
  taskId?: any
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return `[AI Router] GEMINI_API_KEY not configured.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      if (ctx && taskId) {
        let retryCount = 0;
        try {
           const task = await ctx.runQuery(internal.engine.getTaskById, { taskId });
           if (task) retryCount = task.retryCount ?? 0;
        } catch (e) { }

        // Exponential backoff calculation
        const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 30000);
        await ctx.scheduler.runAfter(backoffMs, internal.engine.executeTask, { taskId });
        return `[AI Router] 429 Rate Limit hit. Task rescheduled with exponential backoff (${backoffMs}ms).`;
      }
      throw new Error(`Gemini Rate Limit 429. ${data?.error?.message}`);
    }
    return `[AI Router] Gemini error (${response.status}): ${data?.error?.message ?? "Unknown"}`;
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? `[AI Router] No content.`;
}

/**
 * executeAITask now supports optional context mapping to enable
 * self-healing and auto-backoff scheduling.
 */
export async function executeAITask(
  tier: number,
  systemPrompt: string,
  userPrompt: string,
  ctx?: any,
  taskId?: any
): Promise<string> {
  const config = TIER_MAP[tier];
  if (!config) return `[AI Router] Invalid tier: ${tier}`;

  try {
    if (config.provider === "openai") {
      return await callOpenAI(config.model, systemPrompt, userPrompt, ctx, taskId);
    } else {
      return await callGemini(config.model, systemPrompt, userPrompt, ctx, taskId);
    }
  } catch (error) {
    return `[AI Router] Unexpected error: ${error}`;
  }
}
