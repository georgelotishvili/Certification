from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine
from .models import Base
from .services.media_storage import ensure_media_root
try:
    # When running from project root (e.g. `python -m backend.app.main`)
    from backend.scripts.migrate_results_cols import run as run_results_migration
    from backend.scripts.migrate_media_table import run as run_media_migration
    from backend.scripts.migrate_certificate_score import run as run_certificate_score_migration
    from backend.scripts.migrate_certificate_file_cols import run as run_certificate_file_cols_migration
except ImportError:  # pragma: no cover - fallback for `cd backend; uvicorn app.main:app`
    from scripts.migrate_results_cols import run as run_results_migration  # type: ignore
    from scripts.migrate_media_table import run as run_media_migration  # type: ignore
    from scripts.migrate_certificate_score import run as run_certificate_score_migration  # type: ignore
    from scripts.migrate_certificate_file_cols import run as run_certificate_file_cols_migration  # type: ignore


def create_app() -> FastAPI:
    settings = get_settings()

    Base.metadata.create_all(bind=engine)
    # Ensure additive columns for results exist (idempotent)
    for migrate in (run_results_migration, run_media_migration, run_certificate_score_migration, run_certificate_file_cols_migration):
        try:
            migrate()
        except Exception:
            pass

    ensure_media_root()

    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .routers import auth, exam, admin, users, statements, registry, reviews, expert_uploads

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(exam.router, prefix="/exam", tags=["exam"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])
    app.include_router(users.router, prefix="/users", tags=["users"])
    app.include_router(statements.router, prefix="/statements", tags=["statements"])
    app.include_router(registry.router, prefix="/certified-persons", tags=["registry"])
    app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
    app.include_router(expert_uploads.router, prefix="/expert-uploads", tags=["expert-uploads"])

    return app


app = create_app()


