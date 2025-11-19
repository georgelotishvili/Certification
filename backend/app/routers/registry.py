from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Certificate, User
from ..schemas import RegistryPersonOut


router = APIRouter()

ALLOWED_CERTIFICATE_STATUSES = ("active", "suspended", "expired")
DEFAULT_PROFILE_PHOTO = "https://placehold.co/96x96?text=CP"


@router.get("/registry", response_model=List[RegistryPersonOut])
def list_certified_persons_registry(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[RegistryPersonOut]:
    stmt = (
        select(User, Certificate)
        .join(Certificate, Certificate.user_id == User.id)
        .where(Certificate.status.in_(ALLOWED_CERTIFICATE_STATUSES))
        .order_by(User.created_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.execute(stmt).all()

    results: List[RegistryPersonOut] = []
    for user, certificate in rows:
        full_name_parts = [part for part in (user.first_name, user.last_name) if part]
        full_name = " ".join(full_name_parts).strip()
        results.append(
            RegistryPersonOut(
                id=user.id,
                full_name=full_name or user.first_name or user.last_name or "",
                photo_url=DEFAULT_PROFILE_PHOTO,
                unique_code=(certificate.unique_code or user.code or "").strip(),
                qualification=certificate.level,
                certificate_status=certificate.status,
                rating=0.0,
                exam_score=certificate.exam_score or 0,
                registration_date=user.created_at,
            )
        )
    return results

