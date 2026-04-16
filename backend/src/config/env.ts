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
    // LLM enrichment
    LLM_PROVIDER: process.env.LLM_PROVIDER || "none",       // groq | ollama | none
    LLM_API_KEY: process.env.LLM_API_KEY || "",
    LLM_MODEL: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    // Semantic matching (Phase 3)
    EMBEDDING_SERVICE_URL: process.env.EMBEDDING_SERVICE_URL || "http://localhost:8100",
    SEMANTIC_MATCH_THRESHOLD: parseFloat(process.env.SEMANTIC_MATCH_THRESHOLD || "0.35"),
    RAG_MAX_ITERATIONS: parseInt(process.env.RAG_MAX_ITERATIONS || "3", 10),
    RAG_ATS_THRESHOLD: parseInt(process.env.RAG_ATS_THRESHOLD || "75", 10),
} as const;
