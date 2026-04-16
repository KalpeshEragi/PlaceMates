# ─────────────────────────────────────────────────────────────
# Dockerfile — PlaceMates Embedding Service
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for FAISS
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      build-essential \
      && rm -rf /var/lib/apt/lists/*

# Copy requirements first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the SentenceTransformer model during build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /app/data/faiss_index /app/data/chroma_db

# Expose port
EXPOSE 8100

# Set environment variables
ENV EMBEDDING_HOST=0.0.0.0
ENV EMBEDDING_PORT=8100
ENV FAISS_INDEX_PATH=/app/data/faiss_index/index.faiss
ENV FAISS_ID_MAP_PATH=/app/data/faiss_index/id_map.json
ENV CHROMA_PERSIST_DIR=/app/data/chroma_db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
