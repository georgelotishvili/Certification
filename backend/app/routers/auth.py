from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Exam, ExamCode, Session as ExamSession
from ..schemas import AuthCodeRequest, AuthCodeResponse
from ..security import generate_session_token, verify_code


router = APIRouter()


@router.post("/code", response_model=AuthCodeResponse)
def auth_with_code(payload: AuthCodeRequest, db: Session = Depends(get_db)):
    exam: Optional[Exam] = db.get(Exam, payload.exam_id)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    # Find a matching code entry
    code_stmt = select(ExamCode).where(
        ExamCode.exam_id == exam.id,
        ExamCode.disabled == False,  # noqa: E712
        ExamCode.used == False,      # noqa: E712
    )
    candidates = db.scalars(code_stmt).all()
    match: Optional[ExamCode] = None
    for c in candidates:
        if verify_code(payload.code, c.code_hash):
            match = c
            break

    if not match:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or used code")

    # One active session per code: ensure no active session remains within time window
    active_stmt = select(ExamSession).where(
        ExamSession.code_id == match.id,
        ExamSession.active == True,  # noqa: E712
    )
    active_session = db.scalars(active_stmt).first()
    now = datetime.utcnow()
    if active_session and (active_session.finished_at is None and active_session.ends_at > now):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Active session already exists for this code")

    token = generate_session_token()
    ends_at = now + timedelta(minutes=exam.duration_minutes)
    session = ExamSession(
        exam_id=exam.id,
        code_id=match.id,
        token=token,
        started_at=now,
        ends_at=ends_at,
        active=True,
    )
    db.add(session)

    # Mark code as used (single-use)
    match.used = True
    match.used_at = now

    db.commit()
    db.refresh(session)

    return AuthCodeResponse(
        session_id=session.id,
        token=token,
        exam_id=exam.id,
        duration_minutes=exam.duration_minutes,
        ends_at=ends_at,
    )


