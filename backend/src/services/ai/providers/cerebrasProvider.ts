/**
 * providers/cerebrasProvider.ts
 *
 * Cerebras API provider — extremely fast inference for LLaMA models.
 * Free tier available. Uses OpenAI-compatible endpoint.
 *
 * Cerebras is the fastest inference provider (~2000 tokens/s).
 * Free tier: ~60K TPM, 30 RPM.
 */

import type {
  LLMProvider,
  ProviderConfig,
  LLMCallOptions,
  LLMCallResult,
} from "./types";

const DEFAULT_SYSTEM_PROMPT =
  "You are a senior technical recruiter and resume expert. Always respond with valid JSON only, no markdown fences.";

export class CerebrasProvider implements LLMProvider {
  readonly config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> & { apiKey: string }) {
    this.config = {
      name: config.name ?? "cerebras",
      type: "api",
      model: config.model ?? "llama-3.3-70b",
      baseUrl: config.baseUrl ?? "https://api.cerebras.ai/v1",
      apiKey: config.apiKey,
      tpmLimit: config.tpmLimit ?? 60000,
      rpmLimit: config.rpmLimit ?? 30,
      quality: config.quality ?? "high",
      timeoutMs: config.timeoutMs ?? 30_000,
    };
  }

  async call(prompt: string, options: LLMCallOptions = {}): Promise<LLMCallResult> {
    const {
      temperature = 0.3,
      maxTokens = 2048,
      jsonMode = true,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs!
    );

    const startTime = Date.now();

    try {
      const body: any = {
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      };

      // Cerebras supports JSON mode via response_format
      if (jsonMode) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const resBody = await res.text().catch(() => "");
        const err = new Error(
          `Cerebras API ${res.status}: ${resBody.slice(0, 300)}`
        );
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const usage = data.usage;

      return {
        content,
        provider: this.config.name,
        model: this.config.model,
        quality: this.config.quality,
        tokensUsed: usage
          ? usage.prompt_tokens + usage.completion_tokens
          : undefined,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
