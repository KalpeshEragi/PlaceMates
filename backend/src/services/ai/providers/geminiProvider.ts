/**
 * providers/geminiProvider.ts
 *
 * Google Gemini API provider — Gemini 2.5 Flash / 2.0 Flash.
 * Uses the Gemini REST API (NOT OpenAI-compatible).
 *
 * Auth: API key passed as query parameter ?key={GEMINI_API_KEY}
 * JSON Mode: responseMimeType: "application/json"
 */

import type {
  LLMProvider,
  ProviderConfig,
  LLMCallOptions,
  LLMCallResult,
} from "./types";

const DEFAULT_SYSTEM_PROMPT =
  "You are a senior technical recruiter and resume expert. Always respond with valid JSON only, no markdown fences.";

export class GeminiProvider implements LLMProvider {
  readonly config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> & { apiKey: string }) {
    this.config = {
      name: config.name ?? "gemini",
      type: "api",
      model: config.model ?? "gemini-2.5-flash-preview-05-20",
      baseUrl: config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
      apiKey: config.apiKey,
      tpmLimit: config.tpmLimit ?? 1000000,
      rpmLimit: config.rpmLimit ?? 15,
      quality: config.quality ?? "high",
      timeoutMs: config.timeoutMs ?? 60_000,
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
    const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    try {
      const requestBody: any = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      };

      // Add system instruction if supported
      if (systemPrompt) {
        requestBody.systemInstruction = {
          parts: [{ text: systemPrompt }],
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `Gemini API ${res.status}: ${body.slice(0, 300)}`
        );
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();

      // Extract content from Gemini's response format
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text ?? "";
      const usage = data.usageMetadata;

      return {
        content,
        provider: this.config.name,
        model: this.config.model,
        quality: this.config.quality,
        tokensUsed: usage
          ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0)
          : undefined,
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        latencyMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/models/${this.config.model}?key=${this.config.apiKey}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
