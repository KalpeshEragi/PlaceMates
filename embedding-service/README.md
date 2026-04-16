# PlaceMates Embedding Microservice

> Semantic vector embedding, FAISS search, and ChromaDB resume corpus retrieval.

## Quick Start

### Local Development (without Docker)

```bash
cd embedding-service

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn app.main:app --host 0.0.0.0 --port 8100 --reload
```

### Docker

```bash
docker compose up embedding-service
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/embed/profile` | Embed a user profile text |
| `POST` | `/embed/batch-jobs` | Batch-embed job descriptions + add to FAISS |
| `POST` | `/search/semantic-match` | Cosine similarity search over job index |
| `POST` | `/resume/retrieve` | Retrieve resume examples from ChromaDB |
| `GET`  | `/health` | Health check (model status, index sizes) |

## Architecture

- **Model**: `all-MiniLM-L6-v2` (384-dim, SentenceTransformers)
- **Job Index**: FAISS `IndexFlatIP` on L2-normalized vectors (= cosine similarity)
- **Resume Corpus**: ChromaDB with domain + experience metadata filtering
- **Persistence**: FAISS index saved to disk, ChromaDB persistent storage

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_PORT` | `8100` | Server port |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | SentenceTransformer model name |
| `FAISS_INDEX_PATH` | `./data/faiss_index` | FAISS index file path |
| `CHROMA_PERSIST_DIR` | `./data/chroma_db` | ChromaDB persistence directory |
