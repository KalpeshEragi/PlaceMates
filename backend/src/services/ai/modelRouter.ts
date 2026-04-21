/**
 * modelRouter.ts
 *
 * Intelligent model routing with fallback chains for multi-agent LLM systems.
 *
 * Architecture:
 *   - Each agent role (drafter, critic) has an ordered list of providers
 *   - The router tries providers in order: primary → fallback1 → fallback2
 *   - A provider is skipped if:
 *       (a) its token budget is exhausted (TPM/RPM)
 *       (b) it's in cooldown (recent 429 or 5xx error)
 *       (c) it's marked unhealthy (repeated failures)
 *   - Every response is tagged with the provider/model used for research tracking
 *
 * Fallback strategy:
 *   Groq (70B, free) → Cerebras (70B, free) → Together (70B, paid) → Ollama (7B, local)
 *
 * The router is initialized once at startup by initializeRouter().
 * All subsequent calls go through routeCall().
 */

import { env } from "../../config/env";
import { tokenBudgetManager } from "./tokenBudgetManager";
import { estimateTokens } from "./tokenEstimator";
import type { LLMProvider, LLMCallResult, LLMCallOptions } from "./providers/types";
import { GroqProvider } from "./providers/groqProvider";
import { TogetherProvider } from "./providers/togetherProvider";
import { CerebrasProvider } from "./providers/cerebrasProvider";
import { OllamaProvider } from "./providers/ollamaProvider";

// ─── Provider State Tracking ───────────────────────────────

interface ProviderState {
  provider: LLMProvider;
  healthy: boolean;
  cooldownUntil: number;       // Timestamp — skip until this time
  consecutiveFailures: number;
  lastError?: string;
}

interface RouteConfig {
  role: string;
  providerNames: string[];  // Ordered by preference
}

// ─── Module State ──────────────────────────────────────────

const providerStates = new Map<string, ProviderState>();
let routeConfigs: Record<string, RouteConfig> = {};
let initialized = false;

// ─── Initialization ────────────────────────────────────────

/**
 * Initialize the model router with all configured providers.
 * Call once at application startup.
 *
 * Reads env vars to determine which providers are available.
 * Providers without API keys are silently skipped.
 */
export function initializeRouter(): void {
  if (initialized) return;

  console.log("[ModelRouter] Initializing multi-provider router...");

  // ── Register Groq ──────────────────────────────────────
  if (env.GROQ_API_KEY) {
    const groq = new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL,
      tpmLimit: env.GROQ_TPM_LIMIT,
      rpmLimit: env.GROQ_RPM_LIMIT,
    });
    registerProvider("groq", groq);
  }

  // ── Register Cerebras ──────────────────────────────────
  if (env.CEREBRAS_API_KEY) {
    const cerebras = new CerebrasProvider({
      apiKey: env.CEREBRAS_API_KEY,
      model: env.CEREBRAS_MODEL,
      tpmLimit: env.CEREBRAS_TPM_LIMIT,
      rpmLimit: env.CEREBRAS_RPM_LIMIT,
    });
    registerProvider("cerebras", cerebras);
  }

  // ── Register Together.ai ───────────────────────────────
  if (env.TOGETHER_API_KEY) {
    const together = new TogetherProvider({
      apiKey: env.TOGETHER_API_KEY,
      model: env.TOGETHER_MODEL,
      tpmLimit: env.TOGETHER_TPM_LIMIT,
      rpmLimit: env.TOGETHER_RPM_LIMIT,
    });
    registerProvider("together", together);
  }

  // ── Register Ollama (local — always available if configured) ──
  if (env.OLLAMA_ENABLED) {
    const ollama = new OllamaProvider({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
    });
    registerProvider("ollama", ollama);
  }

  // ── Build Route Configs ────────────────────────────────
  // The order defines fallback priority per role
  const allProviderNames = [...providerStates.keys()];

  routeConfigs = {
    drafter: {
      role: "drafter",
      // Drafter needs quality: prefer 70B models, fallback to local
      providerNames: buildFallbackChain(
        ["groq", "cerebras", "together", "ollama"],
        allProviderNames
      ),
    },
    critic: {
      role: "critic",
      // Critic is scoring/evaluation: can use smaller models
      // Prioritize together (if available, uses 7B) → groq → cerebras → ollama
      providerNames: buildFallbackChain(
        ["together", "groq", "cerebras", "ollama"],
        allProviderNames
      ),
    },
    default: {
      role: "default",
      providerNames: buildFallbackChain(
        ["groq", "cerebras", "together", "ollama"],
        allProviderNames
      ),
    },
  };

  const registeredNames = [...providerStates.keys()];
  console.log(
    `[ModelRouter] ✅ Initialized with ${registeredNames.length} providers: ${registeredNames.join(", ")}`
  );

  for (const [role, config] of Object.entries(routeConfigs)) {
    if (config.providerNames.length > 0) {
      console.log(
        `[ModelRouter]   ${role}: ${config.providerNames.join(" → ")}`
      );
    }
  }

  initialized = true;
}

function registerProvider(name: string, provider: LLMProvider): void {
  providerStates.set(name, {
    provider,
    healthy: true,
    cooldownUntil: 0,
    consecutiveFailures: 0,
  });

  // Register with token budget manager
  tokenBudgetManager.registerProvider(
    name,
    provider.config.tpmLimit,
    provider.config.rpmLimit,
  );
}

/**
 * Build a fallback chain: filter the preferred order by what's actually available.
 */
function buildFallbackChain(
  preferred: string[],
  available: string[]
): string[] {
  return preferred.filter((name) => available.includes(name));
}

// ─── Main Router ───────────────────────────────────────────

/**
 * Route an LLM call to the best available provider.
 *
 * Tries providers in fallback order for the given role.
 * Handles rate limits, cooldowns, and health checks automatically.
 *
 * @param prompt   - The prompt to send
 * @param role     - The agent role ("drafter" | "critic" | "default")
 * @param options  - LLM call options (temperature, maxTokens, etc.)
 * @returns LLMCallResult with content + metadata, or null if all providers fail
 */
export async function routeCall(
  prompt: string,
  role: string = "default",
  options: LLMCallOptions = {},
): Promise<LLMCallResult | null> {
  if (!initialized) {
    initializeRouter();
  }

  const config = routeConfigs[role] ?? routeConfigs["default"];
  if (!config || config.providerNames.length === 0) {
    console.error(`[ModelRouter] No providers available for role "${role}"`);
    return null;
  }

  const estimatedTkns = estimateTokens(prompt, options.maxTokens ?? 2048);

  for (const providerName of config.providerNames) {
    const state = providerStates.get(providerName);
    if (!state) continue;

    // Skip unhealthy providers
    if (!state.healthy) {
      continue;
    }

    // Skip providers in cooldown
    if (Date.now() < state.cooldownUntil) {
      const remainingMs = state.cooldownUntil - Date.now();
      console.log(
        `[ModelRouter] Skipping "${providerName}" — cooldown (${Math.round(remainingMs / 1000)}s remaining)`
      );
      continue;
    }

    // Check if token budget allows this call (non-blocking check)
    const canAcquire = tokenBudgetManager.canAcquire(
      providerName,
      estimatedTkns,
    );

    if (!canAcquire) {
      // If this is the LAST provider in the chain, wait for budget
      const isLastProvider =
        providerName === config.providerNames[config.providerNames.length - 1];

      if (isLastProvider) {
        console.log(
          `[ModelRouter] Last provider "${providerName}" — waiting for budget...`
        );
        const acquired = await tokenBudgetManager.acquireLease(
          providerName,
          estimatedTkns,
        );
        if (!acquired) {
          console.error(
            `[ModelRouter] Budget acquisition timed out for "${providerName}"`
          );
          continue;
        }
      } else {
        // Try the next provider that might have budget
        console.log(
          `[ModelRouter] "${providerName}" budget exhausted — trying next provider`
        );
        continue;
      }
    } else {
      // Acquire the lease (non-blocking since we already checked)
      await tokenBudgetManager.acquireLease(providerName, estimatedTkns);
    }

    // ── Attempt the call ─────────────────────────────────
    try {
      console.log(
        `[ModelRouter] Calling "${providerName}" (model=${state.provider.config.model}, ` +
          `est.tokens=${estimatedTkns}, role=${role})`
      );

      const result = await state.provider.call(prompt, options);

      // Success — reset failure state
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;

      // Reconcile actual token usage
      if (result.tokensUsed) {
        tokenBudgetManager.reportActualUsage(
          providerName,
          result.tokensUsed,
        );
      }

      console.log(
        `[ModelRouter] ✅ "${providerName}" responded in ${result.latencyMs}ms` +
          (result.tokensUsed ? ` (${result.tokensUsed} tokens)` : "")
      );

      return result;
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      state.consecutiveFailures++;
      state.lastError = err.message;

      if (status === 429) {
        // Rate limited — cooldown this provider
        const cooldownMs = 60_000; // 1 minute cooldown on 429
        state.cooldownUntil = Date.now() + cooldownMs;
        console.warn(
          `[ModelRouter] "${providerName}" rate limited (429) — ` +
            `cooldown for ${cooldownMs / 1000}s. Trying next provider.`
        );
      } else if (status >= 500) {
        // Server error — short cooldown
        state.cooldownUntil = Date.now() + 15_000;
        console.warn(
          `[ModelRouter] "${providerName}" server error (${status}) — ` +
            `cooldown for 15s.`
        );
      } else {
        // Other error (auth, model not found, etc.)
        console.error(
          `[ModelRouter] "${providerName}" error: ${err.message}`
        );
      }

      // Mark unhealthy after 5 consecutive failures
      if (state.consecutiveFailures >= 5) {
        state.healthy = false;
        console.error(
          `[ModelRouter] ❌ "${providerName}" marked UNHEALTHY after ${state.consecutiveFailures} failures. ` +
            `Will re-check in 5 minutes.`
        );
        // Auto-recover after 5 minutes
        setTimeout(() => {
          state.healthy = true;
          state.consecutiveFailures = 0;
          console.log(
            `[ModelRouter] 🔄 "${providerName}" marked healthy again (auto-recovery)`
          );
        }, 5 * 60_000);
      }

      // Try the next provider in the chain
      continue;
    }
  }

  // All providers failed
  console.error(
    `[ModelRouter] ❌ All providers failed for role="${role}". Returning null.`
  );
  return null;
}

// ─── Status / Observability ────────────────────────────────

/**
 * Get the current status of all providers.
 * Useful for monitoring dashboards and debugging.
 */
export function getRouterStatus(): Record<
  string,
  {
    healthy: boolean;
    inCooldown: boolean;
    consecutiveFailures: number;
    model: string;
    quality: string;
    budget: ReturnType<typeof tokenBudgetManager.getUsage>;
  }
> {
  const status: Record<string, any> = {};

  for (const [name, state] of providerStates) {
    status[name] = {
      healthy: state.healthy,
      inCooldown: Date.now() < state.cooldownUntil,
      consecutiveFailures: state.consecutiveFailures,
      model: state.provider.config.model,
      quality: state.provider.config.quality,
      budget: tokenBudgetManager.getUsage(name),
    };
  }

  return status;
}

/**
 * Get the number of available (healthy + not in cooldown) providers.
 */
export function getAvailableProviderCount(): number {
  let count = 0;
  for (const state of providerStates.values()) {
    if (state.healthy && Date.now() >= state.cooldownUntil) {
      count++;
    }
  }
  return count;
}
