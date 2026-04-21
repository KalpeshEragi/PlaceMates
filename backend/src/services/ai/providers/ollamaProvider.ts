/**
 * providers/ollamaProvider.ts
 *
 * Ollama local provider — runs models on your own hardware (no rate limits).
 * Suitable for development, testing, and as a fallback when API providers
 * are rate-limited or unavailable.
 *
 * Recommended local models:
 *   - qwen2.5:7b-instruct     (good JSON output, ~6GB VRAM)
 *   - llama3.1:8b-instruct    (general purpose, ~6GB VRAM)
 *   - mistral:7b-instruct     (good for critic/evaluation tasks)
 */

import type {
  LLMProvider,
  ProviderConfig,
  LLMCallOptions,
  LLMCallResult,
} from "./types";

export class OllamaProvider implements LLMProvider {
  readonly config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      name: config.name ?? "ollama",
      type: "local",
      model: config.model ?? "qwen2.5:7b-instruct",
      baseUrl: config.baseUrl ?? "http://localhost:11434",
      tpmLimit: config.tpmLimit ?? 999999, // Unlimited (hardware-bound)
      rpmLimit: config.rpmLimit ?? 999999,
      quality: config.quality ?? "medium",
      timeoutMs: config.timeoutMs ?? 120_000, // Local inference can be slow
    };
  }

  async call(prompt: string, options: LLMCallOptions = {}): Promise<LLMCallResult> {
    const {
      temperature = 0.3,
      maxTokens = 2048,
      systemPrompt = "You are a senior technical recruiter and resume expert. Always respond with valid JSON only.",
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs!
    );

    const startTime = Date.now();

    try {
      // Ollama uses its own API format at /api/generate
      const res = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          prompt: `${systemPrompt}\n\n${prompt}`,
          stream: false,
          format: "json",
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `Ollama ${res.status}: ${body.slice(0, 300)}`
        );
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();
      const content = data.response ?? "";

      // Ollama provides token counts in the response
      const promptTokens = data.prompt_eval_count;
      const completionTokens = data.eval_count;

      return {
        content,
        provider: this.config.name,
        model: this.config.model,
        quality: this.config.quality,
        tokensUsed:
          promptTokens && completionTokens
            ? promptTokens + completionTokens
            : undefined,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
