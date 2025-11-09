from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine
from .models import Base
from .services.media_storage import ensure_media_root
try:
    # When running from project root (e.g. `python -m backend.app.main`)
    from backend.scripts.migrate_results_cols import run as run_migrations
except ImportError:  # pragma: no cover - fallback for `cd backend; uvicorn app.main:app`
    from scripts.migrate_results_cols import run as run_migrations  # type: ignore


def create_app() -> FastAPI:
    settings = get_settings()

    Base.metadata.create_all(bind=engine)
    # Ensure additive columns for results exist (idempotent)
    try:
        run_migrations()
    except Exception:
        pass

    ensure_media_root()

    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .routers import auth, exam, admin, users

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(exam.router, prefix="/exam", tags=["exam"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])
    app.include_router(users.router, prefix="/users", tags=["users"])

    return app


app = create_app()


