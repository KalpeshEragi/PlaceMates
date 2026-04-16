"""
main.py — FastAPI application for the Embedding Microservice.

Endpoints:
  POST /embed/profile          — Embed a user profile text
  POST /embed/batch-jobs       — Embed a batch of job descriptions
  POST /search/semantic-match  — Cosine similarity search over job index
  POST /resume/retrieve        — Retrieve resume examples from ChromaDB
  GET  /health                 — Health check
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import (
    EmbedProfileRequest,
    EmbedProfileResponse,
    EmbedBatchJobsRequest,
    EmbedBatchJobsResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SemanticSearchResult,
    ResumeRetrieveRequest,
    ResumeRetrieveResponse,
    ResumeExample,
    HealthResponse,
)
from .embedder import embed_text, embed_batch, get_model, is_model_loaded
from .vector_store import get_vector_store
from .resume_store import get_resume_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up models and stores on startup."""
    logger.info("🚀 Starting Embedding Microservice...")
    # Pre-load the SentenceTransformer model
    get_model()
    # Initialize stores
    get_vector_store()
    get_resume_store()
    logger.info("✅ All services initialized.")
    yield
    # Shutdown: save FAISS index
    try:
        get_vector_store().save_index()
        logger.info("💾 FAISS index saved on shutdown.")
    except Exception as e:
        logger.error(f"Failed saving FAISS index on shutdown: {e}")


# ── App ─────────────────────────────────────────────────────

app = FastAPI(
    title="PlaceMates Embedding Service",
    version="2.0.0",
    description="Semantic embedding, vector search, and resume corpus retrieval for PlaceMates.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── POST /embed/profile ────────────────────────────────────

@app.post("/embed/profile", response_model=EmbedProfileResponse)
async def embed_profile(req: EmbedProfileRequest):
    """Embed a single user profile text into a dense vector."""
    try:
        vector = embed_text(req.profile_text)
        return EmbedProfileResponse(
            user_id=req.user_id,
            embedding=vector,
            dimension=len(vector),
        )
    except Exception as e:
        logger.error(f"[embed/profile] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /embed/batch-jobs ─────────────────────────────────

@app.post("/embed/batch-jobs", response_model=EmbedBatchJobsResponse)
async def embed_batch_jobs(req: EmbedBatchJobsRequest):
    """Embed a batch of job descriptions. Also adds them to the FAISS index."""
    try:
        texts = [j.text for j in req.jobs]
        ids = [j.job_id for j in req.jobs]

        vectors = embed_batch(texts)

        # Add to FAISS index
        store = get_vector_store()
        store.add_vectors(ids, vectors)

        # Save index periodically (every 100 new jobs)
        if store.size() % 100 < len(ids):
            store.save_index()

        embeddings_response = []
        for jid, vec in zip(ids, vectors):
            embeddings_response.append({
                "job_id": jid,
                "embedding": vec,
                "dimension": len(vec),
            })

        return EmbedBatchJobsResponse(
            embeddings=embeddings_response,
            count=len(embeddings_response),
        )
    except Exception as e:
        logger.error(f"[embed/batch-jobs] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /search/semantic-match ────────────────────────────

@app.post("/search/semantic-match", response_model=SemanticSearchResponse)
async def semantic_match(req: SemanticSearchRequest):
    """Search FAISS index for jobs most similar to the query vector."""
    try:
        store = get_vector_store()
        results = store.search(
            query_vector=req.query_vector,
            top_k=req.top_k,
            threshold=req.threshold,
        )

        search_results = [
            SemanticSearchResult(job_id=jid, score=round(score, 4), rank=i + 1)
            for i, (jid, score) in enumerate(results)
        ]

        return SemanticSearchResponse(
            results=search_results,
            total=len(search_results),
        )
    except Exception as e:
        logger.error(f"[search/semantic-match] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /resume/retrieve ─────────────────────────────────

@app.post("/resume/retrieve", response_model=ResumeRetrieveResponse)
async def resume_retrieve(req: ResumeRetrieveRequest):
    """Retrieve resume examples from ChromaDB by domain + experience + query."""
    try:
        store = get_resume_store()
        raw_examples = store.query(
            domain=req.domain,
            experience_level=req.experience_level,
            query_text=req.query_text,
            top_k=req.top_k,
        )

        examples = []
        for ex in raw_examples:
            examples.append(
                ResumeExample(
                    id=ex.get("id", "unknown"),
                    domain=ex.get("domain", req.domain),
                    experience_level=ex.get("experienceLevel", req.experience_level),
                    summary=ex.get("summary", ""),
                    skills=ex.get("skills", []),
                    experience=ex.get("experience", []),
                    projects=ex.get("projects", []),
                    education=ex.get("education", []),
                    certifications=ex.get("certifications", []),
                    achievements=ex.get("achievements", []),
                    publications=ex.get("publications", []),
                    positions_of_responsibility=ex.get("positionsOfResponsibility", []),
                    open_source=ex.get("openSource", []),
                    hackathons=ex.get("hackathons", []),
                    volunteer_experience=ex.get("volunteerExperience", []),
                    score=ex.get("score", 0.0),
                )
            )

        return ResumeRetrieveResponse(
            examples=examples,
            total=len(examples),
        )
    except Exception as e:
        logger.error(f"[resume/retrieve] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /health ────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    store = get_vector_store()
    resume_store = get_resume_store()

    return HealthResponse(
        status="healthy",
        model_loaded=is_model_loaded(),
        faiss_size=store.size(),
        chroma_size=resume_store.count(),
        embedding_dim=settings.EMBEDDING_DIM,
    )


# ── Main ────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
