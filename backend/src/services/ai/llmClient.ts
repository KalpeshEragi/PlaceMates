/**
 * ai/llmClient.ts
 *
 * Thin LLM abstraction — now powered by the Model Router.
 *
 * This module is the single entry point for all LLM calls in the
 * application. It delegates to modelRouter.ts which handles:
 *   - Multi-provider fallback (Groq → Cerebras → Together → Ollama)
 *   - Token budget management (no more 429 errors)
 *   - Per-provider rate limiting and cooldowns
 *   - Response tagging with provider/model for research tracking
 *
 * Backward compatibility:
 *   - callLLM(prompt, options) still works exactly as before
 *   - Returns string | null (same contract)
 *   - callLLMWithMetadata() returns full result with provider info
 *
 * Legacy single-provider mode:
 *   - If LLM_PROVIDER is set to "groq" or "ollama" (not "multi"),
 *     the system still works through the router with just that one provider.
 *   - If LLM_PROVIDER is "none", returns null immediately.
 */

import { env } from "../../config/env";
import { initializeRouter, routeCall, getRouterStatus } from "./modelRouter";
import type { LLMCallResult } from "./providers/types";

// Initialize the router on first import
let routerReady = false;

function ensureRouter(): void {
  if (routerReady) return;
  if (env.LLM_PROVIDER === "none" || !env.LLM_PROVIDER) return;
  initializeRouter();
  routerReady = true;
}

/**
 * Call LLM with a prompt and return the raw text response.
 * Returns null on any failure (timeout, rate limit, all providers exhausted).
 *
 * This is the backward-compatible API — existing callers don't need changes.
 *
 * @param prompt   - The prompt to send
 * @param options  - Temperature, maxTokens, role (for routing)
 */
export async function callLLM(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    role?: string;
  } = {},
): Promise<string | null> {
  const result = await callLLMWithMetadata(prompt, options);
  return result?.content ?? null;
}

/**
 * Call LLM and return the full result including provider metadata.
 * Used when callers need to know which model was used (for research tracking).
 *
 * @param prompt   - The prompt to send
 * @param options  - Temperature, maxTokens, role (for routing)
 * @returns Full LLMCallResult with provider/model info, or null
 */
export async function callLLMWithMetadata(
  prompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    role?: string;
  } = {},
): Promise<LLMCallResult | null> {
  const provider = env.LLM_PROVIDER;

  if (provider === "none" || !provider) {
    return null;
  }

  ensureRouter();

  const { temperature = 0.3, maxTokens = 2048, role = "default" } = options;

  try {
    const result = await routeCall(prompt, role, {
      temperature,
      maxTokens,
      jsonMode: true,
    });

    return result;
  } catch (err: any) {
    console.error(`[LLM] Unexpected error in routeCall:`, err.message);
    return null;
  }
}

/**
 * Get the current status of all LLM providers.
 * Useful for health check endpoints and debugging.
 */
export function getLLMStatus() {
  ensureRouter();
  return getRouterStatus();
}
