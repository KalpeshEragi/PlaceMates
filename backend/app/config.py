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

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Which model each cheap task uses. Change here, not in code.
    model_extract: str = "openai/gpt-oss-120b"
    model_questions: str = "openai/gpt-oss-20b"


settings = Settings()
