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
  // --- Primary AI ---
  "deepseek-chat": { inputPer1K: 0.00014, outputPer1K: 0.00028 },
  "deepseek-reasoner": { inputPer1K: 0.00055, outputPer1K: 0.00219 },

  // --- Backup and utility AI ---
  "gemini-2.5-flash": { inputPer1K: 0.0003, outputPer1K: 0.0025 },
  "gemini-2.5-pro": { inputPer1K: 0.00125, outputPer1K: 0.01 },
  "text-embedding-004": { inputPer1K: 0, outputPer1K: 0 },
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
