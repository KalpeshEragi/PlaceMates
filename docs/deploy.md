# Deploying PlaceMates for free

| Part | Host | Free limit |
|---|---|---|
| Frontend (Next.js) | Vercel (Hobby) | plenty for a student project |
| Database (Postgres + pgvector) | Neon (Free) | 1 GB storage, 100 compute-hours a month, sleeps when idle |
| Web backend (FastAPI) | Render (Free web service) | 512 MB RAM, sleeps after 15 idle minutes |
| Daily run and resume writing (CrewAI) | GitHub Actions | unlimited minutes on a public repo |

**Why the split:** CrewAI and its models need more memory than Render's free 512 MB. Measured locally, the web backend uses about 313 MB with the embedding model loaded, and it never loads CrewAI when `WORKER=github`. All the heavy AI work runs on GitHub's machines instead:
- **the morning run:** `.github/workflows/daily.yml` at 06:00 IST;
- **"Write tailored resume":** `.github/workflows/resume.yml`, started by the backend.

**Never paste keys into chat or commit them.** They go only into each service's settings page.

You'll need the values from your local `backend/.env`. To make new random secrets, run this from `backend/`:

```bash
.venv/Scripts/python -c "import secrets; print(secrets.token_urlsafe(32))"
```

```bash
.venv/Scripts/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 1. Database: Neon

1. Sign up at neon.com and create a project. Pick region **AWS Asia Pacific (Singapore)** or the closest one to you.
2. Copy the **connection string** (it looks like `postgresql://…neon.tech/neondb?sslmode=require`). This is your `DATABASE_URL`.
3. Copy the example bullets into it. They're built from the private resume corpus, which never leaves your machine. Run this from `backend/` with Docker running:

   ```bash
   .venv/Scripts/python -m scripts.copy_exemplars "<your Neon connection string>"
   ```

   It should print `copied 363 bullets`. It also creates all the tables.

## 2. Frontend: Vercel (first pass, to get its address)

1. Sign up at vercel.com with GitHub, choose **Add New → Project**, and import `KalpeshEragi/PlaceMates`.
2. Set **Root Directory** to `frontend`. Leave everything else at its defaults and deploy.
3. Note the address, e.g. `https://placemates.vercel.app`. This is your **FRONTEND** address. Pages that need the backend won't work yet; that's expected.

## 3. Backend: Render

1. Sign up at render.com with GitHub and choose **New → Web Service**. Pick the `PlaceMates` repo and set:
   - **Root Directory:** `backend`
   - **Runtime / Language:** Docker (it uses `backend/Dockerfile`)
   - **Instance type:** Free
   - **Health check path:** `/health`
2. Under **Environment**, add these. FRONTEND means your Vercel address from step 2.

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string |
   | `FRONTEND_URL` | `https://<FRONTEND>` |
   | `BACKEND_URL` | `https://<your-service>.onrender.com` (shown at the top of the Render page) |
   | `PUBLIC_API_URL` | `https://<FRONTEND>/api` |
   | `JWT_SECRET`, `SESSION_SECRET` | two new random strings |
   | `TOKEN_ENCRYPTION_KEY` | a new Fernet key |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from your `.env` |
   | `GROQ_API_KEY`, `GEMINI_API_KEY`, `APIFY_API_KEY` | from your `.env` |
   | `WORKER` | `github` |
   | `GITHUB_REPO` | `KalpeshEragi/PlaceMates` |
   | `GITHUB_TOKEN` | the token from step 5 (you can add it afterwards) |
   | `JOBS_DAILY_FETCH` | `false` (GitHub Actions does the daily run) |

3. Deploy. The first build takes about 5 minutes. Then opening `https://<your-service>.onrender.com/health` should show `{"status":"ok"}`.

## 4. Connect the frontend to the backend

In Vercel, open **Settings → Environment Variables**, add the two below, then **Redeploy**:

| Key | Value |
|---|---|
| `API_URL` | `https://<your-service>.onrender.com` |
| `NEXT_PUBLIC_BACKEND_URL` | `https://<FRONTEND>/api` |

Login goes through the frontend's `/api` address, so the session cookie belongs to the frontend's domain.

## 5. GitHub: secrets and a token

1. **Token for the backend:** go to GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   - Repository access: only `PlaceMates`.
   - Permissions: **Actions: Read and write**.
   - Copy the token into Render's `GITHUB_TOKEN`.
2. **Secrets for the workflows:** in the repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add `DATABASE_URL`, `FRONTEND_URL`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY` and `APIFY_API_KEY`, with the same values as on Render. `TOKEN_ENCRYPTION_KEY` must match Render exactly, or the workflow can't use the stored Gmail permission.

## 6. Google sign-in

In Google Cloud Console, open **APIs & Services**, then your OAuth client:

1. **Authorised JavaScript origins:** add `https://<FRONTEND>`.
2. **Authorised redirect URIs:** add `https://<FRONTEND>/api/auth/google/callback`. Keep the localhost one for development.
3. On the **OAuth consent screen**, click **Publish app** (switch from Testing to In production).
   - **Why:** in Testing mode Google expires the Gmail permission after 7 days, which would silently stop the daily email.
   - **What changes:** since the app isn't verified by Google, sign-in shows an "unverified app" screen. Click **Advanced → Go to PlaceMates**. That's fine for personal use and up to 100 users.

## 7. Check it works

1. Open `https://<FRONTEND>`, sign in with Google and import your resume on the profile page.
2. On **Today's matches**, set your preferences. The first daily run hasn't happened yet, so there may be no jobs at first.
3. In GitHub, go to **Actions → Daily digest → Run workflow** (leave the inputs empty). This fetches jobs and sends everyone's digest. It takes about 15–25 minutes.
4. Reload **Today's matches**. Clicking **Write tailored resume** starts a **Write resume** run under Actions; the result appears on the page after about 5 minutes.

From then on, the morning run happens at 06:00 IST every day.

## Good to know

- **First load after idling:** Render's free server sleeps after 15 quiet minutes, so the first request afterwards takes about a minute. Optional fix: a free UptimeRobot monitor pinging `/health` every 10 minutes keeps it awake. One service running all month fits Render's 750 free hours.
- **GitHub pauses scheduled workflows** in a repo with no activity for 60 days. Any push, or re-enabling the workflow under Actions, restarts it.
- **AI quota:** Groq's free tier allows about 200k tokens per model per day, which is enough for roughly 3 full resumes. Resumes past the limit wait as "pending", and **Try again** works once it frees up.
- **Logs:**
  - Render: the service's **Logs** tab;
  - workflows: each run under the repo's **Actions** tab.
