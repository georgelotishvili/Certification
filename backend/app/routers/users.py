from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Certificate
from ..schemas import UserCreate, UserOut, CertificateOut, CertificateCreate, CertificateUpdate
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


def _normalize_exam_score(value: int | None) -> int | None:
    if value is None:
        return None
    try:
        score = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="შეფასება უნდა იყოს რიცხვი")
    if score < 0 or score > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="შეფასება უნდა იყოს 0-100 შორის")
    return score


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # Basic validations
    if len(payload.personal_id) != 11 or not payload.personal_id.isdigit():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="personal_id must be 11 digits")
    if len(payload.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="password too short")

    personal_id_norm = payload.personal_id.strip()
    first_name_norm = payload.first_name.strip()
    last_name_norm = payload.last_name.strip()
    phone_norm = payload.phone.strip()
    email_norm = payload.email.strip().lower()

    existing_conflict = db.scalar(
        select(User).where(
            or_(
                User.personal_id == personal_id_norm,
                func.lower(User.email) == email_norm,
                User.phone == phone_norm,
            )
        )
    )
    if existing_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ეს მონაცემები სისტემაში უკვე რეგისტრირებულია",
        )

    # Generate unique code
    code = _gen_code(db)

    settings = get_settings()
    is_founder = (settings.founder_admin_email or "").lower() == email_norm

    user = User(
        personal_id=personal_id_norm,
        first_name=first_name_norm,
        last_name=last_name_norm,
        phone=phone_norm,
        email=email_norm,
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


@router.get("/{user_id}/certificate", response_model=CertificateOut)
def get_certificate(user_id: int, db: Session = Depends(get_db)):
    """Get certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    
    return CertificateOut(
        id=cert.id,
        user_id=cert.user_id,
        unique_code=cert.unique_code,
        level=cert.level,
        status=cert.status,
        issue_date=cert.issue_date,
        validity_term=cert.validity_term,
        valid_until=cert.valid_until,
        exam_score=cert.exam_score,
        created_at=cert.created_at,
        updated_at=cert.updated_at,
    )


@router.post("/{user_id}/certificate", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
def create_certificate(user_id: int, payload: CertificateCreate, db: Session = Depends(get_db)):
    """Create certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    existing = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Certificate already exists")
    
    score = _normalize_exam_score(payload.exam_score)
    cert = Certificate(
        user_id=user_id,
        unique_code=payload.unique_code or user.code,
        level=payload.level or "architect",
        status=payload.status or "active",
        issue_date=payload.issue_date,
        validity_term=payload.validity_term,
        valid_until=payload.valid_until,
        exam_score=score if score is not None else 0,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    
    return CertificateOut(
        id=cert.id,
        user_id=cert.user_id,
        unique_code=cert.unique_code,
        level=cert.level,
        status=cert.status,
        issue_date=cert.issue_date,
        validity_term=cert.validity_term,
        valid_until=cert.valid_until,
        exam_score=cert.exam_score,
        created_at=cert.created_at,
        updated_at=cert.updated_at,
    )


@router.put("/{user_id}/certificate", response_model=CertificateOut)
def update_certificate(user_id: int, payload: CertificateUpdate, db: Session = Depends(get_db)):
    """Update certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    
    if payload.unique_code is not None:
        cert.unique_code = payload.unique_code
    if payload.level is not None:
        cert.level = payload.level
    if payload.status is not None:
        cert.status = payload.status
    if payload.issue_date is not None:
        cert.issue_date = payload.issue_date
    if payload.validity_term is not None:
        cert.validity_term = payload.validity_term
    if payload.valid_until is not None:
        cert.valid_until = payload.valid_until
    if payload.exam_score is not None:
        cert.exam_score = _normalize_exam_score(payload.exam_score)
    
    cert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cert)
    
    return CertificateOut(
        id=cert.id,
        user_id=cert.user_id,
        unique_code=cert.unique_code,
        level=cert.level,
        status=cert.status,
        issue_date=cert.issue_date,
        validity_term=cert.validity_term,
        valid_until=cert.valid_until,
        exam_score=cert.exam_score,
        created_at=cert.created_at,
        updated_at=cert.updated_at,
    )


@router.delete("/{user_id}/certificate", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(user_id: int, db: Session = Depends(get_db)):
    """Delete certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    
    db.delete(cert)
    db.commit()
    return None

