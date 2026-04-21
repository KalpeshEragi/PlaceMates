"""
Configuration for the Embedding Microservice.
All values are read from environment variables with sensible defaults.
"""

import os


class Settings:
    """Application settings loaded from environment variables."""

    # ── Server ──────────────────────────────────────────────
    HOST: str = os.getenv("EMBEDDING_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("EMBEDDING_PORT", "8100"))

    # ── Model ───────────────────────────────────────────────
    MODEL_NAME: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = 384  # Dimension for all-MiniLM-L6-v2

    # ── FAISS ───────────────────────────────────────────────
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", "./data/faiss_index")
    FAISS_ID_MAP_PATH: str = os.getenv("FAISS_ID_MAP_PATH", "./data/faiss_id_map.json")

    # ── ChromaDB ────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION", "resume_examples")

    # ── PostgreSQL (for GeneratedResume table) ────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # ── Search defaults ─────────────────────────────────────
    DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "20"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.35"))


settings = Settings()
