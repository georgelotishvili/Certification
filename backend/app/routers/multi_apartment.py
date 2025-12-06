from __future__ import annotations

import random
import string

from fastapi import APIRouter, Depends, Header, HTTPException, status, Path as FPath, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import MultiApartmentProject, MultiApartmentAnswer, MultiApartmentSubmission, MultiApartmentSettings, User
from ..schemas import (
    MultiApartmentProjectsResponse,
    MultiApartmentProjectsUpdateRequest,
    MultiApartmentProjectPayload,
    MultiApartmentAnswerPayload,
    PublicMultiApartmentProjectResponse,
    MultiApartmentEvaluationSubmitRequest,
    MultiApartmentSettingsResponse,
    MultiApartmentSettingsUpdateRequest,
)
from ..services.media_storage import (
    multi_apartment_pdf_path,
    relative_storage_path,
    resolve_storage_path,
)
from ..routers.admin import _require_admin

router = APIRouter()


def _actor(db: Session, actor_email: str | None) -> User | None:
    """Get user by email, return None if not found."""
    if not actor_email:
        return None
    eml = (actor_email or "").strip().lower()
    if not eml:
        return None
    return db.scalar(select(User).where(User.email == eml))


def _gen_unique_code(db: Session) -> str:
    """Generate a unique 5-digit code for multi-apartment projects."""
    while True:
        candidate = "".join(random.choices(string.digits, k=5))
        exists = db.scalar(select(MultiApartmentProject).where(MultiApartmentProject.code == candidate))
        if not exists:
            return candidate


def _get_or_create_settings(db: Session) -> MultiApartmentSettings:
    """Return existing multi-apartment settings or create with defaults."""
    settings = db.scalar(select(MultiApartmentSettings).limit(1))
    if settings:
        return settings

    settings = MultiApartmentSettings(duration_minutes=60, gate_password="cpig")
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


# Admin endpoints
@router.get("/admin/multi-apartment/settings", response_model=MultiApartmentSettingsResponse)
def get_multi_apartment_settings(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    settings = _get_or_create_settings(db)
    return settings


@router.put("/admin/multi-apartment/settings", response_model=MultiApartmentSettingsResponse)
def update_multi_apartment_settings(
    payload: MultiApartmentSettingsUpdateRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    settings = _get_or_create_settings(db)

    if payload.duration_minutes is not None:
        settings.duration_minutes = max(1, payload.duration_minutes)
    if payload.gate_password is not None:
        settings.gate_password = (payload.gate_password or "").strip()

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/admin/multi-apartment/projects", response_model=MultiApartmentProjectsResponse)
def get_projects_endpoint(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    return get_projects(x_actor_email, db)


def get_projects(
    x_actor_email: str | None,
    db: Session,
):
    _require_admin(db, x_actor_email)
    projects = db.scalars(
        select(MultiApartmentProject)
        .order_by(MultiApartmentProject.order_index, MultiApartmentProject.id)
    ).all()
    
    payloads = []
    for project in projects:
        answers = sorted(project.answers, key=lambda a: (a.order_index, a.id))
        correct_answer_id = next((str(a.id) for a in answers if a.is_correct), None)
        
        payloads.append(
            MultiApartmentProjectPayload(
                id=str(project.id),
                number=project.number,
                code=project.code,
                pdfFile=project.pdf_filename,
                answers=[
                    MultiApartmentAnswerPayload(id=str(a.id), text=a.text)
                    for a in answers
                ],
                correctAnswerId=correct_answer_id,
            )
        )
    
    return MultiApartmentProjectsResponse(projects=payloads)


@router.post("/admin/multi-apartment/projects", response_model=MultiApartmentProjectsResponse)
async def update_projects(
    payload: MultiApartmentProjectsUpdateRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    try:
        _require_admin(db, x_actor_email)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Admin verification failed: {str(e)}",
        )
    
    if not payload or not payload.projects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Projects list is required",
        )
    
    existing_projects = {
        str(p.id): p
        for p in db.scalars(select(MultiApartmentProject)).all()
    }
    processed_ids = set()
    
    for order_idx, project_payload in enumerate(payload.projects or [], start=1):
        project_id_str = project_payload.id
        project_id_int = None
        
        try:
            project_id_int = int(project_id_str)
        except (ValueError, TypeError):
            project_id_int = None
        
        # Ensure number and code even when frontend sends empty values
        project_number = project_payload.number or order_idx
        code_candidate = (project_payload.code or "").strip() or _gen_unique_code(db)
        
        # Check code uniqueness (excluding current project); if new project and code collides, regen
        existing_with_code = db.scalar(
            select(MultiApartmentProject).where(MultiApartmentProject.code == code_candidate)
        )
        if existing_with_code and (project_id_int is None or existing_with_code.id != project_id_int):
            code_candidate = _gen_unique_code(db)
        
        if project_id_int and str(project_id_int) in existing_projects:
            project = existing_projects[str(project_id_int)]
        else:
            project = MultiApartmentProject()
            db.add(project)
        
        # assign fields before flushing so NOT NULL constraints are satisfied
        project.number = project_number
        project.code = code_candidate
        project.order_index = order_idx
        
        db.flush()
        existing_projects[str(project.id)] = project
        processed_ids.add(project.id)
        
        # Update answers
        answers_list = project_payload.answers or []
        # Allow projects without answers - user can add answers later
        
        existing_answers = {str(a.id): a for a in project.answers}
        processed_answer_ids = set()
        
        for ans_idx, answer_payload in enumerate(answers_list, start=1):
            answer_id_str = answer_payload.id
            answer_id_int = None

            try:
                answer_id_int = int(answer_id_str)
            except (ValueError, TypeError):
                answer_id_int = None

            if answer_id_int and str(answer_id_int) in existing_answers:
                answer = existing_answers[str(answer_id_int)]
            else:
                # New answer for this project
                answer = MultiApartmentAnswer(project_id=project.id)
                db.add(answer)

            # Normalize text; allow empty string but never leave it as None,
            # because the DB column is NOT NULL.
            answer_text = (answer_payload.text or "").strip()
            answer.text = answer_text
            answer.order_index = ans_idx
            # Only mark as correct if correctAnswerId is explicitly provided and matches this answer's ID
            # For existing answers, match by database ID
            # For new answers, the frontend sends a temporary ID that won't match the database ID,
            # so we need to match by checking if the correctAnswerId matches the frontend ID from the payload
            if project_payload.correctAnswerId:
                # First try to match by database ID (for existing answers)
                is_correct = str(answer.id) == str(project_payload.correctAnswerId)
                # If not matched and this is a new answer, try to match by the frontend ID from payload
                if not is_correct:
                    # Check if the correctAnswerId matches this answer's frontend ID from the payload
                    answer_frontend_id = str(answer_payload.id)
                    is_correct = str(project_payload.correctAnswerId) == answer_frontend_id
                answer.is_correct = is_correct
            else:
                # If correctAnswerId is null or not provided, no answer should be marked as correct
                answer.is_correct = False

            db.flush()
            existing_answers[str(answer.id)] = answer
            processed_answer_ids.add(answer.id)
        
        # Delete unused answers
        for answer in list(project.answers):
            if answer.id not in processed_answer_ids:
                # Check if used in submissions
                has_submissions = db.scalar(
                    select(func.count())
                    .select_from(MultiApartmentSubmission)
                    .where(MultiApartmentSubmission.selected_answer_id == answer.id)
                ) or 0
                if has_submissions:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="ვერ წაშლით პასუხს, რადგან უკვე არსებობს შეფასებები",
                    )
                db.delete(answer)
    
    # Delete unused projects
    for project in list(existing_projects.values()):
        if project.id not in processed_ids:
            has_submissions = db.scalar(
                select(func.count())
                .select_from(MultiApartmentSubmission)
                .where(MultiApartmentSubmission.project_id == project.id)
            ) or 0
            if has_submissions:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="ვერ წაშლით პროექტს, რადგან უკვე არსებობს შეფასებები",
                )
            # Delete PDF file
            if project.pdf_path:
                try:
                    pdf_path = resolve_storage_path(project.pdf_path)
                    if pdf_path.exists():
                        pdf_path.unlink()
                except Exception:
                    pass
            db.delete(project)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Database error: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail,
        )
    
    try:
        return get_projects(x_actor_email, db)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Failed to retrieve projects after save: {str(e)}\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail,
        )


@router.delete("/admin/multi-apartment/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int = FPath(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    project = db.get(MultiApartmentProject, project_id)
    if not project:
        return
    
    has_submissions = db.scalar(
        select(func.count())
        .select_from(MultiApartmentSubmission)
        .where(MultiApartmentSubmission.project_id == project.id)
    ) or 0
    if has_submissions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="ვერ წაშლით პროექტს, რადგან უკვე არსებობს შეფასებები",
        )
    
    if project.pdf_path:
        try:
            pdf_path = resolve_storage_path(project.pdf_path)
            if pdf_path.exists():
                pdf_path.unlink()
        except Exception:
            pass
    
    db.delete(project)
    db.commit()
    return


@router.post("/admin/multi-apartment/projects/{project_id}/pdf")
async def upload_pdf(
    project_id: int = FPath(...),
    file: UploadFile = File(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    project = db.get(MultiApartmentProject, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files allowed")
    
    filename = file.filename or "project.pdf"
    pdf_path = multi_apartment_pdf_path(project.id, filename)
    
    with open(pdf_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    project.pdf_path = relative_storage_path(pdf_path)
    project.pdf_filename = filename
    db.add(project)
    db.commit()
    
    return {"message": "PDF uploaded successfully"}


@router.get("/admin/multi-apartment/projects/{project_id}/pdf")
def download_pdf(
    project_id: int = FPath(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    project = db.get(MultiApartmentProject, project_id)
    if not project or not project.pdf_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    
    try:
        pdf_path = resolve_storage_path(project.pdf_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    
    if not pdf_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file missing")
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=project.pdf_filename or pdf_path.name,
    )


# Public endpoints
@router.get("/public/multi-apartment/projects/{code}", response_model=PublicMultiApartmentProjectResponse)
def get_public_project(
    code: str = FPath(...),
    db: Session = Depends(get_db),
):
    project = db.scalar(
        select(MultiApartmentProject).where(MultiApartmentProject.code == code.strip())
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    answers = sorted(project.answers, key=lambda a: (a.order_index, a.id))
    pdf_url = (
        f"/public/multi-apartment/projects/{project.code}/pdf"
        if project.pdf_path
        else None
    )
    
    return PublicMultiApartmentProjectResponse(
        id=project.id,
        number=project.number,
        code=project.code,
        pdfUrl=pdf_url,
        answers=[
            MultiApartmentAnswerPayload(id=str(a.id), text=a.text)
            for a in answers
        ],
    )


@router.get("/public/multi-apartment/projects/{code}/pdf")
def get_public_pdf(
    code: str = FPath(...),
    db: Session = Depends(get_db),
):
    project = db.scalar(
        select(MultiApartmentProject).where(MultiApartmentProject.code == code.strip())
    )
    if not project or not project.pdf_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    
    try:
        pdf_path = resolve_storage_path(project.pdf_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not found")
    
    if not pdf_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF file missing")
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=project.pdf_filename or pdf_path.name,
    )


@router.post("/public/multi-apartment/evaluations", status_code=status.HTTP_201_CREATED)
def submit_evaluation(
    payload: MultiApartmentEvaluationSubmitRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    # Get user
    user = _actor(db, x_actor_email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    
    # Get project
    project = db.scalar(
        select(MultiApartmentProject).where(MultiApartmentProject.code == payload.projectCode.strip())
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Verify answer exists and belongs to project
    answer = db.scalar(
        select(MultiApartmentAnswer)
        .where(
            MultiApartmentAnswer.id == payload.selectedAnswerId,
            MultiApartmentAnswer.project_id == project.id,
        )
    )
    if not answer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid answer")
    
    # Check if already submitted
    existing = db.scalar(
        select(MultiApartmentSubmission)
        .where(
            MultiApartmentSubmission.project_id == project.id,
            MultiApartmentSubmission.user_id == user.id,
        )
    )
    
    if existing:
        existing.selected_answer_id = answer.id
        db.add(existing)
    else:
        submission = MultiApartmentSubmission(
            project_id=project.id,
            user_id=user.id,
            selected_answer_id=answer.id,
        )
        db.add(submission)
    
    db.commit()
    return {"message": "Evaluation submitted successfully"}

