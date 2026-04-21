/**
 * tokenBudgetManager.ts
 *
 * Sliding-window token accounting system for LLM rate limit management.
 *
 * Instead of reactively handling 429 errors, this proactively gates all
 * LLM calls by tracking token consumption within a 60-second window.
 *
 * Key design decisions:
 *   - Each provider has independent TPM/RPM budgets
 *   - Token estimation happens BEFORE the call (from estimateTokens)
 *   - Actual usage is reconciled AFTER the call (from API response)
 *   - When budget is insufficient, acquireLease() blocks (await) until
 *     enough tokens have "expired" from the sliding window
 *   - 90% utilization target to avoid edge-case 429s
 */

interface TokenEntry {
  tokens: number;
  timestamp: number;
}

interface ProviderBudget {
  name: string;
  tpmLimit: number;
  rpmLimit: number;
  tokenEntries: TokenEntry[];
  requestTimestamps: number[];
}

const WINDOW_MS = 60_000; // 1-minute sliding window
const UTILIZATION_TARGET = 0.90; // Use only 90% of limit for safety
const POLL_INTERVAL_MS = 1_000; // Check budget every 1s when waiting
const MAX_WAIT_MS = 120_000; // Max 2 minutes wait before giving up

class TokenBudgetManager {
  private providers = new Map<string, ProviderBudget>();

  /**
   * Register a provider with its rate limits.
   * Must be called once at startup for each provider you intend to use.
   */
  registerProvider(name: string, tpmLimit: number, rpmLimit: number): void {
    this.providers.set(name, {
      name,
      tpmLimit,
      rpmLimit,
      tokenEntries: [],
      requestTimestamps: [],
    });
    console.log(
      `[TokenBudget] Registered provider "${name}" — TPM=${tpmLimit}, RPM=${rpmLimit}`
    );
  }

  /**
   * Check if a provider can accept a call RIGHT NOW without waiting.
   */
  canAcquire(providerName: string, estimatedTokens: number): boolean {
    const budget = this.providers.get(providerName);
    if (!budget) return false;

    this.pruneExpired(budget);

    const effectiveTPM = budget.tpmLimit * UTILIZATION_TARGET;
    const effectiveRPM = budget.rpmLimit * UTILIZATION_TARGET;

    const currentTokens = this.sumTokens(budget);
    const currentRequests = budget.requestTimestamps.length;

    return (
      currentTokens + estimatedTokens <= effectiveTPM &&
      currentRequests + 1 <= effectiveRPM
    );
  }

  /**
   * Acquire a token lease. Blocks until budget is available.
   * Returns true if acquired, false if max wait time exceeded.
   *
   * @param providerName    - The provider to acquire budget from
   * @param estimatedTokens - Estimated total tokens (prompt + completion)
   */
  async acquireLease(
    providerName: string,
    estimatedTokens: number,
  ): Promise<boolean> {
    const budget = this.providers.get(providerName);
    if (!budget) {
      console.warn(
        `[TokenBudget] Provider "${providerName}" not registered — allowing call (untracked)`
      );
      return true;
    }

    const startWait = Date.now();

    while (true) {
      this.pruneExpired(budget);

      const effectiveTPM = budget.tpmLimit * UTILIZATION_TARGET;
      const effectiveRPM = budget.rpmLimit * UTILIZATION_TARGET;

      const currentTokens = this.sumTokens(budget);
      const currentRequests = budget.requestTimestamps.length;

      // Check TPM
      if (
        currentTokens + estimatedTokens <= effectiveTPM &&
        currentRequests + 1 <= effectiveRPM
      ) {
        // Budget available — record the lease
        budget.tokenEntries.push({
          tokens: estimatedTokens,
          timestamp: Date.now(),
        });
        budget.requestTimestamps.push(Date.now());
        return true;
      }

      // Budget exhausted — check if we've waited too long
      if (Date.now() - startWait > MAX_WAIT_MS) {
        console.warn(
          `[TokenBudget] Max wait exceeded for "${providerName}" ` +
            `(waited ${Math.round((Date.now() - startWait) / 1000)}s) — ` +
            `current: ${currentTokens}/${effectiveTPM} TPM, ${currentRequests}/${effectiveRPM} RPM`
        );
        return false;
      }

      // Calculate optimal wait time
      const oldestToken = budget.tokenEntries[0];
      const oldestRequest = budget.requestTimestamps[0];
      let waitMs = POLL_INTERVAL_MS;

      if (currentTokens + estimatedTokens > effectiveTPM && oldestToken) {
        // Wait until the oldest token entry expires from the window
        const expiresAt = oldestToken.timestamp + WINDOW_MS;
        waitMs = Math.max(POLL_INTERVAL_MS, expiresAt - Date.now() + 100);
      } else if (currentRequests + 1 > effectiveRPM && oldestRequest) {
        const expiresAt = oldestRequest + WINDOW_MS;
        waitMs = Math.max(POLL_INTERVAL_MS, expiresAt - Date.now() + 100);
      }

      waitMs = Math.min(waitMs, 15_000); // Cap at 15s to re-check periodically

      console.log(
        `[TokenBudget] "${providerName}" throttled — ` +
          `TPM: ${currentTokens}/${Math.round(effectiveTPM)}, ` +
          `RPM: ${currentRequests}/${Math.round(effectiveRPM)}. ` +
          `Waiting ${Math.round(waitMs / 1000)}s...`
      );

      await sleep(waitMs);
    }
  }

  /**
   * Report actual token usage after a call completes.
   * Adjusts the most recent entry to reflect real usage.
   */
  reportActualUsage(providerName: string, actualTokens: number): void {
    const budget = this.providers.get(providerName);
    if (!budget || budget.tokenEntries.length === 0) return;

    // Update the most recent entry with actual usage
    const lastEntry = budget.tokenEntries[budget.tokenEntries.length - 1];
    const diff = actualTokens - lastEntry.tokens;

    if (Math.abs(diff) > 100) {
      // Only log if the difference is significant
      console.log(
        `[TokenBudget] "${providerName}" usage reconciled: ` +
          `estimated=${lastEntry.tokens}, actual=${actualTokens}, diff=${diff > 0 ? "+" : ""}${diff}`
      );
    }

    lastEntry.tokens = actualTokens;
  }

  /**
   * Get current usage stats for a provider.
   */
  getUsage(providerName: string): {
    tokensUsed: number;
    tpmLimit: number;
    requestsUsed: number;
    rpmLimit: number;
    utilizationPct: number;
  } | null {
    const budget = this.providers.get(providerName);
    if (!budget) return null;

    this.pruneExpired(budget);
    const tokensUsed = this.sumTokens(budget);

    return {
      tokensUsed,
      tpmLimit: budget.tpmLimit,
      requestsUsed: budget.requestTimestamps.length,
      rpmLimit: budget.rpmLimit,
      utilizationPct: Math.round((tokensUsed / budget.tpmLimit) * 100),
    };
  }

  // ─── Internal Helpers ──────────────────────────────────────

  private pruneExpired(budget: ProviderBudget): void {
    const cutoff = Date.now() - WINDOW_MS;
    budget.tokenEntries = budget.tokenEntries.filter(
      (e) => e.timestamp > cutoff
    );
    budget.requestTimestamps = budget.requestTimestamps.filter(
      (t) => t > cutoff
    );
  }

  private sumTokens(budget: ProviderBudget): number {
    return budget.tokenEntries.reduce((sum, e) => sum + e.tokens, 0);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Singleton instance — shared across the entire application */
export const tokenBudgetManager = new TokenBudgetManager();
