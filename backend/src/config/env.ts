import dotenv from "dotenv";

dotenv.config();

export const env = {
    PORT: parseInt(process.env.PORT || "5000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    BACKEND_URL: process.env.BACKEND_URL || "http://localhost:5000",
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",
    GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI || "",
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || "https://placeholder-n8n/webhook/n8n/match-jobs",
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET || "",
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "",
    // ── LLM Provider Configuration ───────────────────────────
    // LLM_PROVIDER: "multi" (recommended) | "groq" | "ollama" | "none"
    //   "multi" = model router with fallback across all configured providers
    //   "groq"  = legacy single-provider mode (uses GROQ_API_KEY)
    //   "none"  = disable all LLM calls
    LLM_PROVIDER: process.env.LLM_PROVIDER || "none",
    LLM_API_KEY: process.env.LLM_API_KEY || "",               // Legacy — used as GROQ_API_KEY fallback
    LLM_MODEL: process.env.LLM_MODEL || "llama-3.3-70b-versatile", // Legacy — used as GROQ_MODEL fallback

    // ── Groq (free tier: ~6K TPM, 30 RPM) ───────────────────
    GROQ_API_KEY: process.env.GROQ_API_KEY || process.env.LLM_API_KEY || "",
    GROQ_MODEL: process.env.GROQ_MODEL || process.env.LLM_MODEL || "llama-3.3-70b-versatile",
    GROQ_TPM_LIMIT: parseInt(process.env.GROQ_TPM_LIMIT || "6000", 10),
    GROQ_RPM_LIMIT: parseInt(process.env.GROQ_RPM_LIMIT || "30", 10),

    // ── Cerebras (free tier: ~60K TPM, 30 RPM) ──────────────
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY || "",
    CEREBRAS_MODEL: process.env.CEREBRAS_MODEL || "llama3.1-8b",
    CEREBRAS_TPM_LIMIT: parseInt(process.env.CEREBRAS_TPM_LIMIT || "60000", 10),
    CEREBRAS_RPM_LIMIT: parseInt(process.env.CEREBRAS_RPM_LIMIT || "30", 10),

    // ── Together.ai ($5 free credit, ~60K TPM) ──────────────
    TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || "",
    TOGETHER_MODEL: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    TOGETHER_TPM_LIMIT: parseInt(process.env.TOGETHER_TPM_LIMIT || "60000", 10),
    TOGETHER_RPM_LIMIT: parseInt(process.env.TOGETHER_RPM_LIMIT || "600", 10),

    // ── Ollama (local, unlimited) ────────────────────────────
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct",
    OLLAMA_ENABLED: process.env.OLLAMA_ENABLED === "true",
    // Semantic matching (Phase 3)
    EMBEDDING_SERVICE_URL: process.env.EMBEDDING_SERVICE_URL || "http://localhost:8100",
    SEMANTIC_MATCH_THRESHOLD: parseFloat(process.env.SEMANTIC_MATCH_THRESHOLD || "0.35"),
    RAG_MAX_ITERATIONS: parseInt(process.env.RAG_MAX_ITERATIONS || "3", 10),
    RAG_ATS_THRESHOLD: parseInt(process.env.RAG_ATS_THRESHOLD || "75", 10),
    // ── Evaluation (research pipeline) ──────────────────────
    EVAL_ENABLED: process.env.EVAL_ENABLED === "true",
    EVAL_USERS: parseInt(process.env.EVAL_USERS || "10", 10),
    EVAL_TOP_K: parseInt(process.env.EVAL_TOP_K || "5", 10),
    EVAL_ITERATIONS: parseInt(process.env.EVAL_ITERATIONS || "3", 10),
    // ── Ablation flags (default true — production unchanged) ─
    USE_RAG: process.env.USE_RAG !== "false",
    USE_CRITIC: process.env.USE_CRITIC !== "false",
    USE_ITERATION: process.env.USE_ITERATION !== "false",
} as const;
