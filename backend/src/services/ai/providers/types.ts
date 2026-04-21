/**
 * providers/types.ts
 *
 * Shared types for all LLM providers.
 */

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  systemPrompt?: string;
}

export interface LLMCallResult {
  content: string;
  provider: string;
  model: string;
  quality: "high" | "medium" | "low";
  tokensUsed?: number;       // Total tokens (prompt + completion) from API response
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
}

export interface ProviderConfig {
  name: string;
  type: "api" | "local";
  model: string;
  baseUrl: string;
  apiKey?: string;
  tpmLimit: number;
  rpmLimit: number;
  quality: "high" | "medium" | "low";
  timeoutMs?: number;
}

export interface LLMProvider {
  readonly config: ProviderConfig;
  call(prompt: string, options: LLMCallOptions): Promise<LLMCallResult>;
  healthCheck(): Promise<boolean>;
}
