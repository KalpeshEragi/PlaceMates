"""
Pydantic models for request/response validation.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ── Embed Profile ───────────────────────────────────────────

class EmbedProfileRequest(BaseModel):
    """Request to embed a user profile text."""
    user_id: str
    profile_text: str
    profile_hash: Optional[str] = None  # MD5 hash for cache-busting


class EmbedProfileResponse(BaseModel):
    """Response with the profile embedding vector."""
    user_id: str
    embedding: List[float]
    dimension: int


# ── Embed Batch Jobs ────────────────────────────────────────

class JobText(BaseModel):
    """A single job's ID and description text."""
    job_id: str
    text: str


class EmbedBatchJobsRequest(BaseModel):
    """Request to embed a batch of job descriptions."""
    jobs: List[JobText]


class EmbedBatchJobsResponse(BaseModel):
    """Response with batch embeddings."""
    embeddings: List[Dict[str, Any]]  # [{ job_id, embedding, dimension }]
    count: int


# ── Semantic Search ─────────────────────────────────────────

class SemanticSearchRequest(BaseModel):
    """Request for semantic search (profile vs. jobs)."""
    query_vector: List[float]
    top_k: int = Field(default=20, ge=1, le=100)
    threshold: float = Field(default=0.35, ge=0.0, le=1.0)


class SemanticSearchResult(BaseModel):
    """A single search result."""
    job_id: str
    score: float
    rank: int


class SemanticSearchResponse(BaseModel):
    """Response from semantic search."""
    results: List[SemanticSearchResult]
    total: int
    method: str = "cosine"


# ── Resume Retrieve (ChromaDB) ──────────────────────────────

class ResumeRetrieveRequest(BaseModel):
    """Request to retrieve resume examples from ChromaDB."""
    domain: str
    experience_level: str = "Entry"
    query_text: str
    top_k: int = Field(default=5, ge=1, le=20)


class ResumeExample(BaseModel):
    """A single resume example from the corpus."""
    id: str
    domain: str
    experience_level: str
    summary: str
    skills: List[str]
    experience: List[Dict[str, Any]]
    projects: List[Dict[str, Any]]
    education: List[Dict[str, Any]]
    # Optional extended fields
    certifications: Optional[List[Dict[str, Any]]] = []
    achievements: Optional[List[str]] = []
    publications: Optional[List[Dict[str, Any]]] = []
    positions_of_responsibility: Optional[List[Dict[str, Any]]] = []
    open_source: Optional[List[Dict[str, Any]]] = []
    hackathons: Optional[List[Dict[str, Any]]] = []
    volunteer_experience: Optional[List[Dict[str, Any]]] = []
    score: float = 0.0


class ResumeRetrieveResponse(BaseModel):
    """Response with resume examples."""
    examples: List[ResumeExample]
    total: int


# ── Health ──────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    model_loaded: bool
    faiss_size: int
    chroma_size: int
    embedding_dim: int
