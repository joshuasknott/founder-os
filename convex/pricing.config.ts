// =========================================================================
// Static Provider Pricing Configuration (Iron Core Blueprint)
//
// USD cost per 1,000 tokens for each provider model class.
// Updated manually by the Founder when provider rates change.
// Eliminates runtime API dependencies for cost calculation.
// =========================================================================

export type ModelPricing = {
  inputPer1K: number;
  outputPer1K: number;
};

export const PROVIDER_PRICING: Record<string, ModelPricing> = {
  // --- OpenAI ---
  "o4-mini": { inputPer1K: 0.0011, outputPer1K: 0.0044 },
  "o3": { inputPer1K: 0.01, outputPer1K: 0.04 },
  "gpt-4o-mini": { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gpt-5.2": { inputPer1K: 0.0025, outputPer1K: 0.01 },

  // --- Anthropic ---
  "claude-sonnet-4": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-opus-4": { inputPer1K: 0.015, outputPer1K: 0.075 },

  // --- Google ---
  "gemini-3-flash": { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gemini-3-pro": { inputPer1K: 0.00125, outputPer1K: 0.005 },
};

/**
 * Calculate USD cost for a given model and token usage.
 * Returns 0 if the model is not found in the pricing table.
 */
export function calculateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PROVIDER_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000) * pricing.inputPer1K;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1K;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
