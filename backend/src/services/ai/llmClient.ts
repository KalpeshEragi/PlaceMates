/**
 * ai/llmClient.ts
 *
 * Thin LLM abstraction supporting Groq (cloud) and Ollama (local).
 * Returns null on any failure — callers must handle fallback.
 *
 * Rate limiting: Groq free tier = 30 req/min, 6K tokens/min.
 * For batch project enrichment (~3K tokens/call, 1 call/user) this is plenty.
 */

import { env } from "../../config/env";

interface LLMResponse {
  content: string;
}

const TIMEOUT_MS = 30_000; // 30s for batch of 6 projects
const MAX_RETRIES = 2;

/**
 * Call LLM with a prompt and return the raw text response.
 * Returns null on any failure (timeout, rate limit, parse error, provider=none).
 */
export async function callLLM(
  prompt: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  const provider = env.LLM_PROVIDER;

  if (provider === "none" || !provider) {
    return null;
  }

  const { temperature = 0.3, maxTokens = 2048 } = options;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (provider === "groq") {
        return await callGroq(prompt, temperature, maxTokens);
      }
      if (provider === "ollama") {
        return await callOllama(prompt, temperature, maxTokens);
      }
      console.warn(`[LLM] Unknown provider "${provider}", skipping.`);
      return null;
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;

      // Rate limited — wait and retry
      if (status === 429 && attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
        console.warn(`[LLM] Rate limited, retrying in ${backoff}ms (attempt ${attempt + 1})`);
        await sleep(backoff);
        continue;
      }

      // Server error — retry once
      if (status >= 500 && attempt < MAX_RETRIES) {
        await sleep(1000);
        continue;
      }

      console.error(`[LLM] Failed after ${attempt + 1} attempts:`, err?.message ?? err);
      return null;
    }
  }

  return null;
}

// ─── Groq Client ───────────────────────────────────────────

async function callGroq(
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set for Groq provider");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a senior technical recruiter and resume expert. Always respond with valid JSON only, no markdown fences.",
          },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
      (err as any).status = res.status;
      throw err;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Ollama Client ─────────────────────────────────────────

async function callOllama(
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const baseUrl = env.OLLAMA_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        prompt: `You are a senior technical recruiter and resume expert. Always respond with valid JSON only.\n\n${prompt}`,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
      (err as any).status = res.status;
      throw err;
    }

    const data = await res.json();
    return data.response ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helpers ───────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
