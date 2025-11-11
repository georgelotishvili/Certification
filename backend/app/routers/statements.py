from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Statement, User
from ..schemas import StatementCreate, StatementOut


router = APIRouter()


def _get_actor_user(
    db: Session,
    actor_email: str | None,
) -> User:
    email = (actor_email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("", response_model=StatementOut, status_code=status.HTTP_201_CREATED)
def create_statement(
    payload: StatementCreate,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
) -> StatementOut:
    user = _get_actor_user(db, x_actor_email)
    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message required")

    statement = Statement(user_id=user.id, message=message)
    db.add(statement)
    db.commit()
    db.refresh(statement)
    return StatementOut(id=statement.id, message=statement.message, created_at=statement.created_at)


@router.get("/me", response_model=List[StatementOut])
def list_my_statements(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
) -> List[StatementOut]:
    user = _get_actor_user(db, x_actor_email)
    statements = db.scalars(
        select(Statement)
        .where(Statement.user_id == user.id)
        .order_by(Statement.created_at.desc(), Statement.id.desc())
    ).all()
    return [
        StatementOut(
            id=statement.id,
            message=statement.message,
            created_at=statement.created_at,
        )
        for statement in statements
    ]

