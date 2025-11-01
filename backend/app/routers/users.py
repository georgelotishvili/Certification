from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOut
from ..config import get_settings
from ..security import hash_code


router = APIRouter()


def _gen_code(db: Session) -> str:
    import random
    # Try 100 random attempts for a unique 10-digit code
    for _ in range(100):
        c = str(10**9 + random.randint(0, 9_999_999_999 - 10**9))[:10]
        exists = db.scalar(select(User).where(User.code == c))
        if not exists:
            return c
    # Fallback: time-based last 10 digits
    return str(int(datetime.utcnow().timestamp() * 1000))[-10:]


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # Basic validations
    if len(payload.personal_id) != 11 or not payload.personal_id.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="personal_id must be 11 digits")
    if len(payload.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="password too short")

    # Uniqueness: personal_id
    exists_pid = db.scalar(select(User).where(User.personal_id == payload.personal_id))
    if exists_pid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="personal_id already registered")

    # Generate unique code
    code = _gen_code(db)

    settings = get_settings()
    is_founder = (settings.founder_admin_email or "").lower() == payload.email.lower()

    user = User(
        personal_id=payload.personal_id.strip(),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        phone=payload.phone.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_code(payload.password),
        code=code,
        is_admin=is_founder or False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        personal_id=user.personal_id,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        email=user.email,
        code=user.code,
        is_admin=True if is_founder else bool(user.is_admin),
        is_founder=is_founder,
        created_at=user.created_at,
    )


@router.get("/profile", response_model=UserOut)
def profile(email: str = Query(..., description="User email to lookup"), db: Session = Depends(get_db)):
    # Return public profile (no password) by email
    eml = (email or "").strip().lower()
    if not eml:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
    u = db.scalar(select(User).where(User.email == eml))
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    is_founder = eml == founder_email
    return UserOut(
        id=u.id,
        personal_id=u.personal_id,
        first_name=u.first_name,
        last_name=u.last_name,
        phone=u.phone,
        email=u.email,
        code=u.code,
        is_admin=(eml == founder_email) or bool(u.is_admin),
        is_founder=is_founder,
        created_at=u.created_at,
    )

