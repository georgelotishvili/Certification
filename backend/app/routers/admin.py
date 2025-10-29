from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Block, Question
from ..schemas import AdminStatsResponse


router = APIRouter()


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")

    total_blocks = db.scalar(select(func.count()).select_from(Block)) or 0
    total_questions = db.scalar(select(func.count()).select_from(Question)) or 0
    enabled_blocks = db.scalar(select(func.count()).select_from(Block).where(Block.enabled == True)) or 0  # noqa: E712
    enabled_questions = db.scalar(select(func.count()).select_from(Question).where(Question.enabled == True)) or 0  # noqa: E712

    return AdminStatsResponse(
        total_blocks=total_blocks,
        total_questions=total_questions,
        enabled_blocks=enabled_blocks,
        enabled_questions=enabled_questions,
    )


