"""
vector_store.py — FAISS-based vector store for job embeddings.

Uses Inner Product (IP) index on L2-normalized vectors → cosine similarity.
Supports add, search, save/load from disk.
"""

import json
import logging
import os
from typing import Dict, List, Optional, Tuple

import faiss
import numpy as np

from .config import settings

logger = logging.getLogger(__name__)


class FAISSVectorStore:
    """In-memory FAISS vector index with disk persistence."""

    def __init__(self):
        self._dim = settings.EMBEDDING_DIM
        # Inner Product on L2-normalized vectors = cosine similarity
        self._index = faiss.IndexFlatIP(self._dim)
        # Maps internal FAISS row → external job_id
        self._id_map: List[str] = []
        # Reverse lookup: job_id → FAISS row
        self._id_to_row: Dict[str, int] = {}

        # Try loading from disk on startup
        self._load_from_disk()

    # ── Public API ──────────────────────────────────────────

    def add_vectors(
        self, ids: List[str], vectors: List[List[float]]
    ) -> int:
        """Add vectors to the index (skip duplicates).

        Args:
            ids: External job IDs.
            vectors: Corresponding embedding vectors.

        Returns:
            Number of vectors actually added (skipping duplicates).
        """
        added = 0
        new_ids: List[str] = []
        new_vecs: List[List[float]] = []

        for jid, vec in zip(ids, vectors):
            if jid in self._id_to_row:
                continue  # already indexed
            new_ids.append(jid)
            new_vecs.append(vec)

        if not new_vecs:
            return 0

        arr = np.array(new_vecs, dtype=np.float32)
        # Ensure L2-normalized
        faiss.normalize_L2(arr)

        base_row = len(self._id_map)
        self._index.add(arr)

        for i, jid in enumerate(new_ids):
            self._id_map.append(jid)
            self._id_to_row[jid] = base_row + i
            added += 1

        logger.info(f"Added {added} vectors to FAISS (total: {self._index.ntotal})")
        return added

    def search(
        self,
        query_vector: List[float],
        top_k: int = 20,
        threshold: float = 0.0,
    ) -> List[Tuple[str, float]]:
        """Search for the closest vectors to the query.

        Args:
            query_vector: The query embedding.
            top_k: Number of results to return.
            threshold: Minimum cosine similarity score.

        Returns:
            List of (job_id, score) tuples, sorted by score descending.
        """
        if self._index.ntotal == 0:
            return []

        q = np.array([query_vector], dtype=np.float32)
        faiss.normalize_L2(q)

        k = min(top_k, self._index.ntotal)
        scores, indices = self._index.search(q, k)

        results: List[Tuple[str, float]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self._id_map):
                continue
            if float(score) < threshold:
                continue
            results.append((self._id_map[idx], float(score)))

        return results

    def size(self) -> int:
        """Return number of vectors in the index."""
        return self._index.ntotal

    def contains(self, job_id: str) -> bool:
        """Check if a job_id is already indexed."""
        return job_id in self._id_to_row

    # ── Persistence ─────────────────────────────────────────

    def save_index(self) -> None:
        """Save FAISS index and ID map to disk."""
        os.makedirs(os.path.dirname(settings.FAISS_INDEX_PATH), exist_ok=True)

        faiss.write_index(self._index, settings.FAISS_INDEX_PATH)
        with open(settings.FAISS_ID_MAP_PATH, "w") as f:
            json.dump(self._id_map, f)

        logger.info(
            f"FAISS index saved: {self._index.ntotal} vectors → {settings.FAISS_INDEX_PATH}"
        )

    def _load_from_disk(self) -> None:
        """Attempt to load FAISS index and ID map from disk."""
        if not os.path.exists(settings.FAISS_INDEX_PATH):
            logger.info("No existing FAISS index found — starting fresh.")
            return

        if not os.path.exists(settings.FAISS_ID_MAP_PATH):
            logger.warning("FAISS index found but no ID map — starting fresh.")
            return

        try:
            self._index = faiss.read_index(settings.FAISS_INDEX_PATH)
            with open(settings.FAISS_ID_MAP_PATH, "r") as f:
                self._id_map = json.load(f)

            self._id_to_row = {jid: i for i, jid in enumerate(self._id_map)}
            logger.info(
                f"FAISS index loaded: {self._index.ntotal} vectors from disk"
            )
        except Exception as e:
            logger.error(f"Failed loading FAISS index: {e}. Starting fresh.")
            self._index = faiss.IndexFlatIP(self._dim)
            self._id_map = []
            self._id_to_row = {}


# ── Singleton Instance ──────────────────────────────────────

_store: Optional[FAISSVectorStore] = None


def get_vector_store() -> FAISSVectorStore:
    """Get the singleton FAISS vector store."""
    global _store
    if _store is None:
        _store = FAISSVectorStore()
    return _store
