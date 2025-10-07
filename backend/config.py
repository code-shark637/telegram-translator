from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # PostgreSQL connection string, e.g. postgresql://postgres:password@localhost:5432/telegram_translator
    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    telegram_api_id: int
    telegram_api_hash: str

    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
