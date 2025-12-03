from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, or_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Certificate
from ..schemas import UserCreate, UserOut, CertificateOut, CertificateCreate, CertificateUpdate
from ..config import get_settings
from ..security import hash_code
from ..services.media_storage import resolve_storage_path, relative_storage_path, certificate_file_path


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

    is_admin_user = is_founder or bool(user.is_admin)
    # მთავარ ადმინს ყოველთვის exam_permission = true
    # სხვა ადმინებს exam_permission = true
    # არა-ადმინებს exam_permission = user.exam_permission (რაც ბაზაშია)
    if is_founder:
        exam_perm = True
    elif is_admin_user:
        exam_perm = True  # ადმინებს exam_permission ყოველთვის true
    else:
        exam_perm = bool(user.exam_permission)  # არა-ადმინებს რაც ბაზაშია
    return UserOut(
        id=user.id,
        personal_id=user.personal_id,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        email=user.email,
        code=user.code,
        is_admin=is_admin_user,
        is_founder=is_founder,
        exam_permission=exam_perm,
        created_at=user.created_at,
    )


@router.get("/{user_id}/public", response_model=UserOut)
def public_profile(
    user_id: int,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """
    Public profile lookup by user_id. Returns non-sensitive fields needed for profile view.
    Access: any authenticated actor.
    """
    actor_email = (x_actor_email or "").strip().lower()
    if not actor_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor required")
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    is_founder = (user.email or "").lower() == founder_email
    is_admin_user = is_founder or bool(user.is_admin)
    # მთავარ ადმინს ყოველთვის exam_permission = true
    # სხვა ადმინებს exam_permission = true
    # არა-ადმინებს exam_permission = user.exam_permission (რაც ბაზაშია)
    if is_founder:
        exam_perm = True
    elif is_admin_user:
        exam_perm = True  # ადმინებს exam_permission ყოველთვის true
    else:
        exam_perm = bool(user.exam_permission)  # არა-ადმინებს რაც ბაზაშია
    return UserOut(
        id=user.id,
        personal_id=user.personal_id,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        email=user.email,
        code=user.code,
        is_admin=is_admin_user,
        is_founder=is_founder,
        exam_permission=exam_perm,
        created_at=user.created_at,
    )

@router.get("/profile", response_model=UserOut)
def profile(
    email: str = Query(..., description="User email to lookup"),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    # Return public profile (no password) by email
    eml = (email or "").strip().lower()
    if not eml:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")
    # Require authorized session (actor)
    actor_email = (x_actor_email or "").strip().lower()
    if not actor_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor required")
    u = db.scalar(select(User).where(User.email == eml))
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    is_founder = eml == founder_email
    # Only self or admin/founder can view
    actor = db.scalar(select(User).where(User.email == actor_email))
    if not actor:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor not found")
    if actor.email != eml and not (actor.is_admin or actor.email.lower() == founder_email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    is_admin_user = is_founder or bool(u.is_admin)
    # მთავარ ადმინს ყოველთვის exam_permission = true
    # სხვა ადმინებს exam_permission = true
    # არა-ადმინებს exam_permission = u.exam_permission (რაც ბაზაშია)
    if is_founder:
        exam_perm = True
    elif is_admin_user:
        exam_perm = True  # ადმინებს exam_permission ყოველთვის true
    else:
        exam_perm = bool(u.exam_permission)  # არა-ადმინებს რაც ბაზაშია
    return UserOut(
        id=u.id,
        personal_id=u.personal_id,
        first_name=u.first_name,
        last_name=u.last_name,
        phone=u.phone,
        email=u.email,
        code=u.code,
        is_admin=is_admin_user,
        is_founder=is_founder,
        exam_permission=exam_perm,
        created_at=u.created_at,
    )


@router.get("/{user_id}/certificate", response_model=CertificateOut)
def get_certificate(
    user_id: int,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """Get certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # AuthZ: allow any authenticated actor to view certificate metadata
    actor_email = (x_actor_email or "").strip().lower()
    if not actor_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor required")
    actor = db.scalar(select(User).where(User.email == actor_email))
    if not actor:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="actor not found")
    
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    
    return CertificateOut.model_validate(cert)


@router.post("/{user_id}/certificate", response_model=CertificateOut, status_code=status.HTTP_201_CREATED)
def create_certificate(
    user_id: int,
    payload: CertificateCreate,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """Create certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Only admin/founder can create
    actor_email = (x_actor_email or "").strip().lower()
    actor = db.scalar(select(User).where(User.email == actor_email)) if actor_email else None
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    if not actor or not (actor.is_admin or actor.email.lower() == founder_email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    
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
    
    return CertificateOut.model_validate(cert)


@router.put("/{user_id}/certificate", response_model=CertificateOut)
def update_certificate(
    user_id: int,
    payload: CertificateUpdate,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """Update certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Only admin/founder can update
    actor_email = (x_actor_email or "").strip().lower()
    actor = db.scalar(select(User).where(User.email == actor_email)) if actor_email else None
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    if not actor or not (actor.is_admin or actor.email.lower() == founder_email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    
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
    
    return CertificateOut.model_validate(cert)


@router.delete("/{user_id}/certificate", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(
    user_id: int,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """Delete certificate for a user"""
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Only admin/founder can delete
    actor_email = (x_actor_email or "").strip().lower()
    actor = db.scalar(select(User).where(User.email == actor_email)) if actor_email else None
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    if not actor or not (actor.is_admin or actor.email.lower() == founder_email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    
    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")

    # Delete file from disk if exists
    if cert.file_path:
        try:
            path = resolve_storage_path(cert.file_path)
            if path.exists():
                path.unlink()
        except Exception:
            pass

    db.delete(cert)
    db.commit()
    return None


@router.post("/{user_id}/certificate/file", status_code=status.HTTP_204_NO_CONTENT)
def upload_certificate_file(
    user_id: int,
    file: UploadFile = File(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    """Upload certificate PDF for a user (admin/founder only)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Only admin/founder can upload
    actor_email = (x_actor_email or "").strip().lower()
    actor = db.scalar(select(User).where(User.email == actor_email)) if actor_email else None
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    if not actor or not (actor.is_admin or actor.email.lower() == founder_email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")

    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")

    content_type = (file.content_type or "").lower()
    if content_type not in ("application/pdf", "application/x-pdf", "binary/octet-stream", "application/octet-stream"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ფაილი უნდა იყოს PDF")

    target = certificate_file_path(user_id, "certificate.pdf")
    tmp = target.with_suffix(".tmp")

    with open(tmp, "wb") as out:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    tmp.replace(target)
    size = target.stat().st_size

    # Update DB meta
    cert.file_path = relative_storage_path(target)
    cert.filename = "certificate.pdf"
    cert.mime_type = "application/pdf"
    cert.size_bytes = int(size)
    cert.updated_at = datetime.utcnow()
    db.add(cert)
    db.commit()
    return None


@router.get("/{user_id}/certificate/file")
def download_certificate_file(
    user_id: int,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    actor: str | None = Query(None, alias="actor"),
    db: Session = Depends(get_db),
):
    """Download certificate PDF.
    Public download is allowed for active (non-expired) certificates.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    cert = db.scalar(select(Certificate).where(Certificate.user_id == user_id))
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate not found")
    if not cert.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # Allow public download only if certificate is active and not expired
    status_norm = (cert.status or "").strip().lower()
    if status_norm in ("suspended", "expired"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="certificate inactive")
    if cert.valid_until is not None and cert.valid_until < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="certificate inactive")

    try:
        path = resolve_storage_path(cert.file_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path,
        media_type=cert.mime_type or "application/pdf",
        filename=cert.filename or path.name,
    )

