"""
resume_store.py — ChromaDB-backed resume example store.

Stores resume examples with metadata (domain, experienceLevel) for RAG retrieval.
Queries by domain + experience + semantic similarity.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from .config import settings
from .embedder import embed_text, embed_batch

logger = logging.getLogger(__name__)


class ResumeStore:
    """ChromaDB-backed store for resume corpus examples."""

    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            f"ChromaDB collection '{settings.CHROMA_COLLECTION_NAME}' "
            f"has {self._collection.count()} documents"
        )

    # ── Add Examples ────────────────────────────────────────

    def add_examples(self, examples: List[Dict[str, Any]]) -> int:
        """Insert resume examples into ChromaDB.

        Each example must have: domain, experienceLevel, summary, skills,
        experience, projects, education (at minimum).

        Returns:
            Number of examples added.
        """
        if not examples:
            return 0

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[Dict[str, str]] = []
        embeddings: List[List[float]] = []

        # Build searchable text for each example
        texts_to_embed: List[str] = []

        for i, ex in enumerate(examples):
            doc_id = ex.get("id") or f"{ex['domain']}_{ex.get('experienceLevel','entry')}_{i}"

            # Check if already exists
            existing = self._collection.get(ids=[doc_id])
            if existing and existing["ids"]:
                continue

            # Build a searchable text from key resume fields
            search_text = self._build_search_text(ex)

            ids.append(doc_id)
            documents.append(search_text)
            metadatas.append({
                "domain": ex.get("domain", "Unknown"),
                "experience_level": ex.get("experienceLevel", "Entry"),
                "full_data": json.dumps(ex),  # Store full resume as metadata
            })
            texts_to_embed.append(search_text)

        if not ids:
            return 0

        # Batch embed
        embeddings = embed_batch(texts_to_embed)

        self._collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )

        logger.info(f"Added {len(ids)} resume examples to ChromaDB (total: {self._collection.count()})")
        return len(ids)

    # ── Query ───────────────────────────────────────────────

    def query(
        self,
        domain: str,
        experience_level: str,
        query_text: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Retrieve resume examples by domain + experience + semantic similarity.

        Args:
            domain: Target domain (e.g. "Frontend Developer").
            experience_level: e.g. "Entry", "Mid", "Senior".
            query_text: Free-text query for semantic search.
            top_k: Max results.

        Returns:
            List of resume example dicts with score.
        """
        if self._collection.count() == 0:
            return []

        # Build ChromaDB where filter
        where_filter: Dict[str, Any] = {}
        conditions = []
        if domain:
            conditions.append({"domain": {"$eq": domain}})
        if experience_level:
            conditions.append({"experience_level": {"$eq": experience_level}})

        if len(conditions) > 1:
            where_filter = {"$and": conditions}
        elif len(conditions) == 1:
            where_filter = conditions[0]

        # Embed query
        query_embedding = embed_text(query_text)

        try:
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, self._collection.count()),
                where=where_filter if where_filter else None,
            )
        except Exception as e:
            logger.warning(f"ChromaDB query with filter failed: {e}. Trying without filter.")
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, self._collection.count()),
            )

        if not results or not results["ids"] or not results["ids"][0]:
            return []

        examples: List[Dict[str, Any]] = []
        for i, doc_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else 1.0

            # Parse full data from metadata
            full_data = {}
            if meta.get("full_data"):
                try:
                    full_data = json.loads(meta["full_data"])
                except json.JSONDecodeError:
                    pass

            full_data["id"] = doc_id
            full_data["score"] = round(1.0 - distance, 4)  # Convert distance to similarity
            examples.append(full_data)

        return examples

    def count(self) -> int:
        """Return total number of resume examples in the store."""
        return self._collection.count()

    # ── Internal ────────────────────────────────────────────

    @staticmethod
    def _build_search_text(example: Dict[str, Any]) -> str:
        """Build a searchable text string from resume example fields."""
        parts = []

        if example.get("summary"):
            parts.append(example["summary"])

        if example.get("skills"):
            parts.append("Skills: " + ", ".join(example["skills"]))

        for exp in example.get("experience", []):
            parts.append(
                f"{exp.get('role', '')} at {exp.get('company', '')}: {exp.get('description', '')}"
            )

        for proj in example.get("projects", []):
            tech = ", ".join(proj.get("techStack", []))
            parts.append(
                f"Project {proj.get('name', '')}: {proj.get('description', '')} ({tech})"
            )

        for edu in example.get("education", []):
            parts.append(
                f"{edu.get('degree', '')} from {edu.get('institution', '')}"
            )

        return " | ".join(parts)


# ── Singleton ───────────────────────────────────────────────

_store: Optional[ResumeStore] = None


def get_resume_store() -> ResumeStore:
    """Get the singleton ChromaDB resume store."""
    global _store
    if _store is None:
        _store = ResumeStore()
    return _store
