/**
 * embeddingClient.ts
 *
 * HTTP client for the Python embedding microservice.
 * Built-in timeout (10s), retry (2x), and circuit-breaker pattern.
 *
 * All methods return null on failure — callers must handle graceful degradation.
 */

import { env } from "../../config/env";

const BASE_URL = env.EMBEDDING_SERVICE_URL;
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

// ── Circuit Breaker ────────────────────────────────────────

let consecutiveFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000; // 1 minute

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    if (Date.now() < circuitOpenUntil) return true;
    // Half-open: allow one attempt
    consecutiveFailures = CIRCUIT_THRESHOLD - 1;
  }
  return false;
}

function onSuccess(): void {
  consecutiveFailures = 0;
}

function onFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(`[EmbeddingClient] Circuit breaker OPEN for ${CIRCUIT_RESET_MS}ms`);
  }
}

// ── HTTP Helper ────────────────────────────────────────────

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T | null> {
  if (isCircuitOpen()) {
    console.warn(`[EmbeddingClient] Circuit open — skipping ${path}`);
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      onSuccess();
      return data as T;
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 500;
        console.warn(
          `[EmbeddingClient] ${path} attempt ${attempt + 1} failed: ${err.message}. Retrying in ${backoff}ms...`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.error(`[EmbeddingClient] ${path} failed after ${attempt + 1} attempts:`, err.message);
      onFailure();
      return null;
    }
  }

  return null;
}

// ── Public API ─────────────────────────────────────────────

export interface EmbedProfileResult {
  user_id: string;
  embedding: number[];
  dimension: number;
}

export interface EmbedBatchJobsResult {
  embeddings: Array<{ job_id: string; embedding: number[]; dimension: number }>;
  count: number;
}

export interface SemanticSearchResult {
  job_id: string;
  score: number;
  rank: number;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  total: number;
  method: string;
}

export interface ResumeExample {
  id: string;
  domain: string;
  experience_level: string;
  summary: string;
  skills: string[];
  experience: any[];
  projects: any[];
  education: any[];
  certifications: any[];
  achievements: string[];
  score: number;
}

export interface ResumeRetrieveResponse {
  examples: ResumeExample[];
  total: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  faiss_size: number;
  chroma_size: number;
  embedding_dim: number;
}

/** Check if the Python embedding service is healthy. */
export async function isHealthy(): Promise<boolean> {
  const result = await request<HealthResponse>("/health", "GET");
  return result?.status === "healthy" && result.model_loaded === true;
}

/** Embed a user profile text into a 384-dim vector. */
export async function embedProfile(
  userId: string,
  profileText: string,
  profileHash?: string,
): Promise<EmbedProfileResult | null> {
  return request<EmbedProfileResult>("/embed/profile", "POST", {
    user_id: userId,
    profile_text: profileText,
    profile_hash: profileHash,
  });
}

/** Embed a batch of job descriptions and add to FAISS index. */
export async function embedBatchJobs(
  jobs: Array<{ job_id: string; text: string }>,
): Promise<EmbedBatchJobsResult | null> {
  return request<EmbedBatchJobsResult>("/embed/batch-jobs", "POST", { jobs });
}

/** Semantic cosine search over the FAISS job index. */
export async function semanticSearch(
  queryVector: number[],
  topK: number = 20,
  threshold: number = env.SEMANTIC_MATCH_THRESHOLD,
): Promise<SemanticSearchResponse | null> {
  return request<SemanticSearchResponse>("/search/semantic-match", "POST", {
    query_vector: queryVector,
    top_k: topK,
    threshold,
  });
}

/** Retrieve resume examples from ChromaDB for RAG context. */
export async function retrieveResumeExamples(
  domain: string,
  experienceLevel: string,
  queryText: string,
  topK: number = 5,
): Promise<ResumeRetrieveResponse | null> {
  return request<ResumeRetrieveResponse>("/resume/retrieve", "POST", {
    domain,
    experience_level: experienceLevel,
    query_text: queryText,
    top_k: topK,
  });
}

/** Check max cosine similarity of an embedding against all stored resumes. */
export async function checkSimilarity(
  embedding: number[],
): Promise<{ maxSimilarity: number } | null> {
  return request<{ maxSimilarity: number }>("/check-similarity", "POST", {
    embedding,
  });
}
