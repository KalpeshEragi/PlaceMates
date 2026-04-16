# PlaceMates — Complete Setup & Run Guide

A step-by-step guide to set up and run the entire PlaceMates system from scratch.

---

## Prerequisites

Before you begin, make sure you have these installed:

| Tool | Version | Check Command |
|------|---------|--------------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Python** | 3.10+ | `python --version` |
| **Docker Desktop** | Latest | `docker --version` |
| **Git** | Any | `git --version` |

### Accounts Needed

| Service | Purpose | Free Tier? |
|---------|---------|------------|
| [NeonDB](https://neon.tech) | PostgreSQL database | ✅ Yes |
| [Cloudinary](https://cloudinary.com) | Resume PDF storage | ✅ Yes |
| [Google Cloud Console](https://console.cloud.google.com) | OAuth login | ✅ Yes |
| [GitHub OAuth](https://github.com/settings/developers) | GitHub integration | ✅ Yes |
| [Groq](https://console.groq.com) | LLM API (for RAG) | ✅ Yes |
| [Apify](https://apify.com) | LinkedIn job scraping | Free trial |

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/PlaceMates.git
cd PlaceMates
```

---

## Step 2 — Set Up the Database (NeonDB)

1. Go to [neon.tech](https://neon.tech) → Create a new project
2. Copy the connection string (it looks like):
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Save this — you'll use it in Step 4

---

## Step 3 — Set Up External Services

### 3a. Google OAuth (Login)
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Set Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
4. Copy `Client ID` and `Client Secret`

### 3b. GitHub OAuth (GitHub integration)
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL: `http://localhost:5000/api/integrations/github/callback`
4. Copy `Client ID` and `Client Secret`

### 3c. Cloudinary (Resume storage)
1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard → Copy: Cloud Name, API Key, API Secret

### 3d. Groq (LLM for RAG pipeline)
1. Sign up at [console.groq.com](https://console.groq.com)
2. Create an API key
3. Copy the key

---

## Step 4 — Configure Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your values:

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# ── Auth — Google OAuth ──────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ── Auth — JWT (generate any random string) ──────────────
JWT_SECRET=my-super-secret-jwt-key-change-me

# ── Auth — GitHub OAuth ──────────────────────────────────
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# ── Gemini (optional) ────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key

# ── Encryption (generate with: openssl rand -hex 32) ─────
TOKEN_ENCRYPTION_KEY=your_64_char_hex_string

# ── Cloudinary ───────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── n8n Integration ──────────────────────────────────────
N8N_WEBHOOK_URL=http://localhost:5678/webhook/n8n/match-jobs
N8N_WEBHOOK_SECRET=any-shared-secret-here
INTERNAL_API_KEY=my-internal-api-key-change-me

# ── LLM for RAG Pipeline ────────────────────────────────
LLM_PROVIDER=groq
LLM_API_KEY=your_groq_api_key
LLM_MODEL=llama-3.3-70b-versatile

# ── Semantic Matching ────────────────────────────────────
EMBEDDING_SERVICE_URL=http://localhost:8100
SEMANTIC_MATCH_THRESHOLD=0.35
RAG_MAX_ITERATIONS=3
RAG_ATS_THRESHOLD=75

# ── URLs ─────────────────────────────────────────────────
PORT=5000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

---

## Step 5 — Install Backend Dependencies & Setup Database

```bash
# From the backend/ directory
npm install

# Push the Prisma schema to your NeonDB
npx prisma db push

# Generate Prisma client
npx prisma generate
```

**Verify:** Run `npx prisma studio` — it should open a browser showing your tables.

---

## Step 6 — Configure & Start Frontend

```bash
cd ../frontend

# Create .env.local (only one variable needed)
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local

# Install dependencies
npm install
```

---

## Step 7 — Set Up the Embedding Service (Python)

### Option A: Run with Docker (Recommended)

```bash
cd ..   # Back to project root (PlaceMates/)
docker compose up embedding-service -d
```

Wait ~2 minutes for the model to download on first run.

**Verify:**
```bash
curl http://localhost:8100/health
```

You should see:
```json
{ "status": "healthy", "model_loaded": true, "embedding_dim": 384 }
```

### Option B: Run Locally (Without Docker)

```bash
cd embedding-service

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Install dependencies (takes a few minutes)
pip install -r requirements.txt

# Start the service
uvicorn app.main:app --host 0.0.0.0 --port 8100
```

---

## Step 8 — Seed the Resume Corpus

This loads 70 resume examples (7 domains × 10 each) into ChromaDB for the RAG pipeline.

```bash
cd embedding-service

# If running locally (with venv activated):
python -m scripts.seed_corpus

# If running via Docker:
docker exec placemate-embedding python -m scripts.seed_corpus
```

**Verify:**
```bash
curl http://localhost:8100/health
```
Look for `"chroma_size": 70` in the response.

---

## Step 9 — Start Everything

Open **3 terminals** and run:

### Terminal 1 — Backend
```bash
cd backend
npm run dev
```
You should see: `Server running on port 5000`

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
```
You should see: `Ready on http://localhost:3000`

### Terminal 3 — Embedding Service (if not using Docker)
```bash
cd embedding-service
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8100
```

---

## Step 10 — Set Up n8n (Job Automation)

### 10a. Start n8n
```bash
# From project root
docker compose up n8n -d
```
Open `http://localhost:5678` in your browser.

### 10b. Create API Credential in n8n
1. Go to **Credentials** → **Add Credential**
2. Choose **Header Auth**
3. Set:
   - **Name**: `PlaceMates Internal API`
   - **Header Name**: `x-api-key`
   - **Header Value**: same as your `INTERNAL_API_KEY` from `.env`

### 10c. Set Variables in n8n
1. Go to **Settings** → **Variables**
2. Add:
   - `BACKEND_URL` = `http://host.docker.internal:5000`
   - `INTERNAL_API_KEY` = same as your `.env`

### 10d. Import the Workflow
1. Go to **Workflows** → **Import from File**
2. Select `PlaceMates v2.0 Workflow.json` from the project root
3. Re-link your **Apify** credential on the LinkedIn Scraper node

### 10e. Test It
1. Click **Execute Workflow** (manual trigger)
2. Watch each node execute step by step
3. Check the backend terminal for logs

---

## Verification Checklist

Run through these checks to confirm everything works:

| # | Check | How |
|---|-------|-----|
| 1 | Backend runs | Open `http://localhost:5000/api/health` |
| 2 | Frontend runs | Open `http://localhost:3000` |
| 3 | Embedding service | `curl http://localhost:8100/health` |
| 4 | Database connected | `npx prisma studio` shows tables |
| 5 | ChromaDB seeded | Health shows `chroma_size: 70` |
| 6 | OAuth login | Click "Sign in with Google" on frontend |
| 7 | n8n accessible | Open `http://localhost:5678` |

---

## Useful Commands

| Task | Command |
|------|---------|
| Start everything (Docker) | `docker compose up -d` |
| Stop everything (Docker) | `docker compose down` |
| View backend logs | Terminal running `npm run dev` in backend/ |
| View n8n logs | `docker logs placemate-n8n -f` |
| View embedding logs | `docker logs placemate-embedding -f` |
| Reset database | `npx prisma db push --force-reset` (⚠️ deletes data) |
| Open DB browser | `npx prisma studio` |
| Re-seed resumes | `docker exec placemate-embedding python -m scripts.seed_corpus` |
| Build frontend | `cd frontend && npm run build` |

---

## Architecture at a Glance

```
┌─────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   Frontend      │      │   Backend       │      │ Embedding Service│
│   Next.js       │◄────►│   Express       │◄────►│ FastAPI + Python  │
│   :3000         │      │   :5000         │      │ :8100            │
└─────────────────┘      └────────┬────────┘      └──────────────────┘
                                  │                        │
                          ┌───────┴───────┐         ┌──────┴──────┐
                          │   NeonDB      │         │  ChromaDB   │
                          │  PostgreSQL   │         │  (70 resumes│
                          └───────────────┘         │  + FAISS)   │
                                                    └─────────────┘
                         ┌────────────────┐
                         │   n8n          │
                         │ (Orchestrator) │
                         │   :5678        │
                         └────────────────┘
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED :8100` | Embedding service not running. Start it first |
| `prisma db push` fails | Check your `DATABASE_URL` connection string |
| ChromaDB telemetry error | Harmless — ignore the `capture() takes 1 argument` error |
| n8n can't reach backend | Use `http://host.docker.internal:5000` not `localhost` |
| Google OAuth redirect error | Make sure redirect URI matches exactly in Google Console |
| `readmeAnalyzer` TS error | Pre-existing, unrelated to our changes — ignore |
| RAG pipeline returns null | Check `LLM_PROVIDER` and `LLM_API_KEY` are set |
| Frontend auth fails | Verify `JWT_SECRET` is set and consistent |
