"""
embedder.py — SentenceTransformer wrapper (singleton)

Loads the model once on startup, provides single-text and batch embeddings.
Model: all-MiniLM-L6-v2  →  384-dimensional dense vectors.
"""

import logging
from typing import List
from sentence_transformers import SentenceTransformer
from .config import settings

logger = logging.getLogger(__name__)

# ── Singleton model instance ────────────────────────────────

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    """Lazy-load the SentenceTransformer model (cached after first call)."""
    global _model
    if _model is None:
        logger.info(f"Loading SentenceTransformer model: {settings.MODEL_NAME}")
        _model = SentenceTransformer(settings.MODEL_NAME)
        logger.info(
            f"Model loaded. Embedding dimension: {_model.get_sentence_embedding_dimension()}"
        )
    return _model


def embed_text(text: str) -> List[float]:
    """Embed a single text string into a dense vector.

    Args:
        text: The input text to encode.

    Returns:
        A list of floats (384-dim embedding).
    """
    model = get_model()
    vector = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vector.tolist()


def embed_batch(texts: List[str], batch_size: int = 32) -> List[List[float]]:
    """Embed a batch of texts into dense vectors.

    Args:
        texts: List of input texts to encode.
        batch_size: Internal SentenceTransformer batch size.

    Returns:
        A list of embedding vectors.
    """
    model = get_model()
    vectors = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        batch_size=batch_size,
        show_progress_bar=False,
    )
    return vectors.tolist()


def is_model_loaded() -> bool:
    """Check if the model has been loaded."""
    return _model is not None
