from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://placemates:placemates@localhost:5432/placemates"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    jwt_secret: str = "change-me"
    session_secret: str = "change-me"
    token_encryption_key: str = ""
    jwt_ttl_days: int = 7

    google_client_id: str = ""
    google_client_secret: str = ""

    # Jobs: keyless company boards always run; these extra sources run only when keys are set.
    jobs_fresh_days: int = 3
    jobs_daily_fetch: bool = False        # run the fetcher every day inside the API process
    jobs_daily_fetch_hour_ist: int = 6
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jsearch_api_key: str = ""
    apify_api_key: str = ""               # env name is case-insensitive (Apify_API_KEY works)
    apify_monthly_budget_usd: float = 4.5  # stay under Apify's $5 free monthly credit

    groq_api_key: str = ""
    gemini_api_key: str = ""              # resume writer (falls back to Groq if unavailable)
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Which model each cheap task uses. Change here, not in code.
    # Each model has its own Groq rate limit, so steps are spread across models.
    model_extract: str = "openai/gpt-oss-120b"      # resume extraction, analyst
    model_questions: str = "openai/gpt-oss-20b"     # planner
    model_interviewer: str = "openai/gpt-oss-20b"   # question writing
    # Interpreter shares 120b with the analyst, which only runs at session start/end.
    # (qwen3.8-27b was tried: frequent malformed tool calls on Groq.)
    model_interpreter: str = "openai/gpt-oss-120b"


settings = Settings()
