from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Exam Backend"
    secret_key: str = "dev-secret-key"
    cors_origins: List[str] = [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]
    founder_admin_email: Optional[str] = "naormala@gmail.com"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


