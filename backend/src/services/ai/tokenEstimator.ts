/**
 * tokenEstimator.ts
 *
 * Estimates token count for a prompt + completion without calling a tokenizer.
 * Uses a character-based heuristic calibrated for LLaMA-family models.
 *
 * LLaMA tokenizer averages ~3.5 chars/token for English text with some JSON.
 * We use 3.3 to overestimate by ~5-10%, giving a safety margin.
 */

const CHARS_PER_TOKEN = 3.3;

/**
 * Estimate the total token cost of an LLM call (prompt + completion).
 *
 * @param prompt       - The full prompt text
 * @param maxTokens    - Max completion tokens requested
 * @returns Estimated total tokens (prompt + max completion)
 */
export function estimateTokens(prompt: string, maxTokens: number = 2048): number {
  const promptTokens = Math.ceil(prompt.length / CHARS_PER_TOKEN);
  // Add ~50 tokens for system message overhead (role tags, formatting)
  const overhead = 50;
  return promptTokens + overhead + maxTokens;
}

/**
 * Estimate just the prompt tokens (no completion).
 */
export function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / CHARS_PER_TOKEN) + 50;
}
