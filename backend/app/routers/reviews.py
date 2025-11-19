from __future__ import annotations

from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header, Path
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Certificate, Rating, Comment
from ..schemas import ReviewRatingCreate, ReviewCommentCreate, ReviewCommentOut, ReviewsSummaryOut


router = APIRouter()


def _get_actor_user(db: Session, actor_email: str | None) -> User:
    eml = (actor_email or "").strip().lower()
    if not eml:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor required")
    user = db.scalar(select(User).where(User.email == eml))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="actor not found")
    return user


def _ensure_target_certified(db: Session, user_id: int) -> User:
    target = db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not certified")
    return target


@router.get("/{user_id}/summary", response_model=ReviewsSummaryOut)
def reviews_summary(
    user_id: int = Path(..., ge=1),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    # Require authorized session
    _get_actor_user(db, x_actor_email)
    # Average and count across current active ratings (one per author enforced by unique constraint)
    avg_score = db.scalar(select(func.avg(Rating.score)).where(Rating.target_user_id == user_id)) or 0.0
    count = db.scalar(select(func.count(Rating.id)).where(Rating.target_user_id == user_id)) or 0

    actor_score = None
    if x_actor_email:
        try:
            actor = _get_actor_user(db, x_actor_email)
            actor_score = db.scalar(
                select(Rating.score).where(
                    Rating.target_user_id == user_id,
                    Rating.author_user_id == actor.id,
                )
            )
        except HTTPException:
            actor_score = None

    # Comments (chronological)
    rows = db.execute(
        select(
            Comment.id,
            Comment.target_user_id,
            Comment.author_user_id,
            Comment.message,
            Comment.created_at,
            User.first_name,
            User.last_name,
        )
        .join(User, User.id == Comment.author_user_id)
        .where(Comment.target_user_id == user_id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    comments: List[ReviewCommentOut] = [
        ReviewCommentOut(
            id=row.id,
            target_user_id=row.target_user_id,
            author_user_id=row.author_user_id,
            author_first_name=row.first_name,
            author_last_name=row.last_name,
            message=row.message,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return ReviewsSummaryOut(
        target_user_id=user_id,
        average=float(round(avg_score or 0.0, 2)),
        ratings_count=int(count or 0),
        actor_score=int(actor_score) if actor_score is not None else None,
        comments=comments,
    )


@router.post("/{user_id}/rating", response_model=ReviewsSummaryOut, status_code=status.HTTP_201_CREATED)
def set_rating(
    user_id: int,
    payload: ReviewRatingCreate,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    if payload.score is None or int(payload.score) < 1 or int(payload.score) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="score must be 1..10")
    actor = _get_actor_user(db, x_actor_email)
    target = _ensure_target_certified(db, user_id)
    if actor.id == target.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="self rating is not allowed")

    # Upsert rating (one per actor-target)
    existing = db.scalar(
        select(Rating).where(
            Rating.target_user_id == user_id,
            Rating.author_user_id == actor.id,
        )
    )
    if existing:
        existing.score = int(payload.score)
        existing.updated_at = datetime.utcnow()
    else:
        db.add(Rating(target_user_id=user_id, author_user_id=actor.id, score=int(payload.score)))
    db.commit()

    return reviews_summary(user_id=user_id, x_actor_email=x_actor_email, db=db)


@router.post("/{user_id}/comments", response_model=ReviewCommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    user_id: int,
    payload: ReviewCommentCreate,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    actor = _get_actor_user(db, x_actor_email)
    _ensure_target_certified(db, user_id)
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty message")
    comment = Comment(target_user_id=user_id, author_user_id=actor.id, message=message)
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return ReviewCommentOut(
        id=comment.id,
        target_user_id=comment.target_user_id,
        author_user_id=comment.author_user_id,
        author_first_name=actor.first_name,
        author_last_name=actor.last_name,
        message=comment.message,
        created_at=comment.created_at,
    )

