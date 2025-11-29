from __future__ import annotations

from datetime import datetime, timezone
import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, status, Path, Response, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_db
from ..models import (
    Block, ExamMedia, Question, Session as ExamSession, Answer, Option, Question as Q, User, Exam, Statement, Certificate,
    ProjectEvaluationProject, ProjectEvaluationViolation, ProjectEvaluationSettings, ProjectEvaluationSession,
)
from ..schemas import (
    AdminBlocksResponse,
    AdminBlocksUpdateRequest,
    AdminBlockPayload,
    AdminQuestionPayload,
    AdminAnswerPayload,
    AdminStatsResponse,
    ExamSettingsResponse,
    ExamSettingsUpdateRequest,
    ResultListItem,
    ResultListResponse,
    ResultDetailResponse,
    ResultMediaResponse,
    ResultMediaItem,
    AnswerDetail,
    AnswerOptionDetail,
    BlockStatDetail,
    UsersListResponse,
    UserOut,
    ToggleAdminRequest,
    AdminUserUpdateRequest,
    AdminStatementsResponse,
    AdminStatementOut,
    StatementSeenRequest,
    AdminProjectEvaluationProjectOut,
    AdminProjectEvaluationProjectCreate,
    AdminProjectEvaluationProjectUpdate,
    AdminProjectEvaluationViolationOut,
    AdminProjectEvaluationViolationCreate,
    AdminProjectEvaluationViolationUpdate,
    AdminProjectEvaluationSettingsOut,
    AdminProjectEvaluationSettingsUpdate,
    AdminProjectEvaluationSessionOut,
    AdminProjectEvaluationProjectsListResponse,
    AdminProjectEvaluationViolationsListResponse,
    AdminProjectEvaluationSessionsListResponse,
)
from ..services.media_storage import resolve_storage_path, ensure_media_root, relative_storage_path


router = APIRouter()

MEDIA_TYPES = ("camera", "screen")


def _require_admin(
    db: Session,
    x_actor_email: str | None = None,
) -> None:
    settings = get_settings()

    actor_email = (x_actor_email or "").strip().lower()
    founder_email = (settings.founder_admin_email or "").lower()

    if actor_email and actor_email == founder_email:
        return

    if actor_email:
        user = db.scalar(select(User).where(func.lower(User.email) == actor_email))
        if user and user.is_admin:
            return

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")


def _is_founder_actor(actor_email: str | None) -> bool:
    settings = get_settings()
    return (settings.founder_admin_email or "").lower() == (actor_email or "").strip().lower()


def _actor_email_normalized(actor_email: str | None) -> str | None:
    if not actor_email:
        return None
    return actor_email.strip().lower() or None


def _get_or_create_exam(db: Session, exam_id: int | None = None) -> Exam:
    exam: Exam | None = None
    if exam_id:
        exam = db.get(Exam, exam_id)
    if not exam:
        exam = db.scalars(select(Exam).order_by(Exam.id.asc()).limit(1)).first()
    if not exam:
        exam = Exam(title="Default Exam", duration_minutes=45, gate_password="cpig")
        db.add(exam)
        db.commit()
        db.refresh(exam)
        return exam
    if not exam.gate_password:
        exam.gate_password = "cpig"
        db.add(exam)
        db.commit()
        db.refresh(exam)
    return exam


def _exam_settings_payload(exam: Exam) -> ExamSettingsResponse:
    return ExamSettingsResponse(
        exam_id=exam.id,
        title=exam.title,
        duration_minutes=exam.duration_minutes,
        gate_password=exam.gate_password,
    )


# ================= Auth =================

@router.get("/auth/verify", status_code=status.HTTP_204_NO_CONTENT)
def admin_verify(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    return


# ================= Exam Settings =================

@router.get("/exam/settings", response_model=ExamSettingsResponse)
def get_exam_settings(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db)
    return _exam_settings_payload(exam)


@router.put("/exam/settings", response_model=ExamSettingsResponse)
def update_exam_settings(
    payload: ExamSettingsUpdateRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db, payload.exam_id)

    if payload.title is not None:
        exam.title = payload.title
    if payload.duration_minutes is not None:
        exam.duration_minutes = payload.duration_minutes
    if payload.gate_password is not None:
        exam.gate_password = payload.gate_password

    db.add(exam)
    db.commit()
    db.refresh(exam)
    return _exam_settings_payload(exam)


# ================= Exam Blocks =================

@router.get("/exam/blocks", response_model=AdminBlocksResponse)
def get_exam_blocks(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db)
    return _blocks_payload(exam)


def _blocks_payload(exam: Exam) -> AdminBlocksResponse:
    blocks = sorted(exam.blocks, key=lambda b: b.order_index)
    return AdminBlocksResponse(
        blocks=[
            AdminBlockPayload(
                id=str(b.id),
                title=b.title,
                qty=b.qty,
                orderIndex=b.order_index,
                enabled=b.enabled,
                questions=[
                    AdminQuestionPayload(
                        id=str(q.id),
                        text=q.text,
                        code=q.code or "",
                        orderIndex=q.order_index,
                        enabled=q.enabled,
                        answers=[
                            AdminAnswerPayload(
                                id=str(a.id),
                                text=a.text,
                                isCorrect=a.is_correct,
                            )
                            for a in sorted(q.options, key=lambda opt: opt.id)
                        ],
                    )
                    for q in sorted(b.questions, key=lambda q: q.order_index)
                ],
            )
            for b in blocks
        ],
    )


@router.put("/exam/blocks", response_model=AdminBlocksResponse)
def update_exam_blocks(
    payload: AdminBlocksUpdateRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db)

    # Collect all IDs that should exist
    block_ids_to_keep: set[int] = set()
    question_ids_to_keep: set[int] = set()
    answer_ids_to_keep: set[int] = set()

    for block_payload in payload.blocks:
        block_id = int(block_payload.id)
        block_ids_to_keep.add(block_id)
        for question_payload in block_payload.questions:
            question_id = int(question_payload.id)
            question_ids_to_keep.add(question_id)
            for answer_payload in question_payload.answers:
                answer_id = int(answer_payload.id)
                answer_ids_to_keep.add(answer_id)

    # Delete blocks that are not in the payload
    existing_blocks = db.scalars(select(Block).where(Block.exam_id == exam.id)).all()
    for block in existing_blocks:
        if block.id not in block_ids_to_keep:
            db.delete(block)

    # Delete questions that are not in the payload
    existing_questions = db.scalars(select(Question).where(Question.block_id.in_([b.id for b in existing_blocks]))).all()
    for question in existing_questions:
        if question.id not in question_ids_to_keep:
            db.delete(question)

    # Delete answers that are not in the payload
    existing_answers = db.scalars(select(Option).where(Option.question_id.in_([q.id for q in existing_questions]))).all()
    for answer in existing_answers:
        if answer.id not in answer_ids_to_keep:
            db.delete(answer)

    db.flush()

    # Now create/update blocks, questions, and answers
    for block_index, block_payload in enumerate(payload.blocks):
        block_id = int(block_payload.id)
        block = db.get(Block, block_id)
        if not block:
            block = Block(exam_id=exam.id, id=block_id)
            db.add(block)
        block.title = block_payload.title
        block.qty = block_payload.qty
        block.order_index = block_index
        block.enabled = block_payload.enabled

        for question_index, question_payload in enumerate(block_payload.questions):
            question_id = int(question_payload.id)
            question = db.get(Question, question_id)
            if not question:
                question = Question(block_id=block.id, id=question_id)
                db.add(question)
            question.text = question_payload.text
            question.code = question_payload.code or None
            question.order_index = question_index
            question.enabled = question_payload.enabled

            for answer_payload in question_payload.answers:
                answer_id = int(answer_payload.id)
                answer = db.get(Option, answer_id)
                if not answer:
                    answer = Option(question_id=question.id, id=answer_id)
                    db.add(answer)
                answer.text = answer_payload.text
                answer.is_correct = answer_payload.isCorrect

    db.commit()

    refreshed_exam = db.get(Exam, exam.id)
    if not refreshed_exam:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to refresh exam")

    return _blocks_payload(refreshed_exam)


@router.get("/stats", response_model=AdminStatsResponse)
def admin_stats(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

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


def _session_status(session: ExamSession) -> str:
    if session.finished_at:
        return "completed"
    if not session.active:
        return "inactive"
    return "active"


def _session_score(session: ExamSession) -> float | None:
    if not session.finished_at:
        return None
    total = session.total_questions or 0
    if total == 0:
        return None
    correct = session.correct_answers or 0
    return round((correct / total) * 100, 2)


# ================= Results =================

@router.get("/results", response_model=ResultListResponse)
def admin_results(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=1000),
    search: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),  # active|completed|inactive
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    stmt = select(ExamSession).options(selectinload(ExamSession.exam))
    if search:
        q = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                ExamSession.candidate_first_name.ilike(q),
                ExamSession.candidate_last_name.ilike(q),
                ExamSession.candidate_code.ilike(q),
            )
        )
    if status_filter == "completed":
        stmt = stmt.where(ExamSession.finished_at.isnot(None))
    elif status_filter == "active":
        stmt = stmt.where(ExamSession.active == True, ExamSession.finished_at.is_(None))  # noqa: E712
    elif status_filter == "inactive":
        stmt = stmt.where(ExamSession.active == False)  # noqa: E712

    stmt = stmt.order_by(ExamSession.started_at.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    offset = (page - 1) * size
    sessions = db.scalars(stmt.offset(offset).limit(size)).all()

    items = []
    for s in sessions:
        items.append(
            ResultListItem(
                sessionId=s.id,
                candidateFirstName=s.candidate_first_name or "",
                candidateLastName=s.candidate_last_name or "",
                candidateCode=s.candidate_code or "",
                startedAt=s.started_at,
                finishedAt=s.finished_at,
                status=_session_status(s),
                score=_session_score(s),
                examTitle=s.exam.title if s.exam else "Unknown",
            )
        )

    return ResultListResponse(items=items, total=total, page=page, size=size)


@router.get("/results/{session_id}", response_model=ResultDetailResponse)
def admin_result_detail(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    session = db.scalar(
        select(ExamSession)
        .where(ExamSession.id == session_id)
        .options(selectinload(ExamSession.exam), selectinload(ExamSession.answers).selectinload(Answer.option))
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    answers_detail = []
    for answer in sorted(session.answers, key=lambda a: a.question_id or 0):
        option_detail = None
        if answer.option:
            option_detail = AnswerOptionDetail(
                id=answer.option.id,
                text=answer.option.text,
                isCorrect=answer.option.is_correct,
            )
        answers_detail.append(
            AnswerDetail(
                questionId=answer.question_id or 0,
                questionText=answer.question_text or "",
                optionId=answer.option_id,
                option=option_detail,
                isCorrect=answer.is_correct or False,
            )
        )

    blocks_detail = []
    if session.exam:
        for block in sorted(session.exam.blocks, key=lambda b: b.order_index):
            block_answers = [a for a in answers_detail if any(q.id == a.questionId for q in block.questions)]
            correct_in_block = sum(1 for a in block_answers if a.isCorrect)
            total_in_block = len(block_answers)
            blocks_detail.append(
                BlockStatDetail(
                    blockId=block.id,
                    blockTitle=block.title,
                    correct=correct_in_block,
                    total=total_in_block,
                )
            )

    return ResultDetailResponse(
        sessionId=session.id,
        candidateFirstName=session.candidate_first_name or "",
        candidateLastName=session.candidate_last_name or "",
        candidateCode=session.candidate_code or "",
        startedAt=session.started_at,
        finishedAt=session.finished_at,
        status=_session_status(session),
        score=_session_score(session),
        examTitle=session.exam.title if session.exam else "Unknown",
        totalQuestions=session.total_questions or 0,
        correctAnswers=session.correct_answers or 0,
        answers=answers_detail,
        blocks=blocks_detail,
    )


@router.get("/results/{session_id}/media", response_model=ResultMediaResponse)
def admin_result_media(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    media_records = db.scalars(select(ExamMedia).where(ExamMedia.session_id == session_id)).all()
    items = []
    for media in media_records:
        items.append(
            ResultMediaItem(
                mediaType=media.media_type,
                filename=media.filename,
                storagePath=media.storage_path,
                uploadedAt=media.uploaded_at,
            )
        )

    return ResultMediaResponse(items=items)


@router.get("/results/{session_id}/media/file")
def admin_download_media_file(
    session_id: int = Path(...),
    media_type: str = Query(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    if media_type not in MEDIA_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid media type")

    session = db.get(ExamSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    media = db.scalar(
        select(ExamMedia).where(ExamMedia.session_id == session_id, ExamMedia.media_type == media_type)
    )
    if not media or not media.storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")

    try:
        path = resolve_storage_path(media.storage_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found")

    return FileResponse(
        path,
        media_type="video/webm",
        filename=media.filename or f"{media_type}_{session_id}.webm",
    )


@router.delete("/results/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_result(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    session_obj = db.get(ExamSession, session_id)
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Delete related media files
    media_records = db.scalars(select(ExamMedia).where(ExamMedia.session_id == session_id)).all()
    for media in media_records:
        if media.storage_path:
            try:
                abs_path = resolve_storage_path(media.storage_path)
                if abs_path.exists():
                    abs_path.unlink()
            except Exception:
                pass  # Continue even if file deletion fails

    # Delete the session directory if it exists and is empty
    try:
        media_root = ensure_media_root()
        session_dir = media_root / f"session_{session_id}"
        if session_dir.exists() and session_dir.is_dir():
            # Try to remove the directory (will only work if empty or all files deleted)
            try:
                session_dir.rmdir()
            except OSError:
                # Directory not empty or other error, that's okay
                pass
    except Exception:
        pass  # Continue even if directory deletion fails

    db.delete(session_obj)
    db.commit()
    return


@router.get("/statements/{statement_id}/file")
def admin_download_statement_file(
    statement_id: int,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    actor: str | None = Query(None, alias="actor"),
    db: Session = Depends(get_db),
):
    _require_admin(db, actor or x_actor_email)
    st = db.get(Statement, statement_id)
    if not st or not st.attachment_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        path = resolve_storage_path(st.attachment_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path,
        media_type=st.attachment_mime_type or "application/octet-stream",
        filename=st.attachment_filename or path.name,
    )


# ================= Users admin endpoints =================

@router.get("/users", response_model=UsersListResponse)
def admin_users(
    page: int = 1,
    size: int = 1000000,
    search: str | None = None,
    only_admins: bool = False,
    sort: str = "date_desc",  # date_desc|date_asc|name_asc|name_desc
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    settings = get_settings()

    stmt = select(User)
    if search:
        q = f"%{search.lower()}%"
        stmt = stmt.where(
            or_(
                User.first_name.ilike(q),
                User.last_name.ilike(q),
                User.email.ilike(q),
                User.phone.ilike(q),
                User.personal_id.ilike(q),
                User.code.ilike(q),
            )
        )
    if only_admins:
        stmt = stmt.where(User.is_admin == True)  # noqa: E712

    if sort == "date_asc":
        stmt = stmt.order_by(User.created_at.asc())
    elif sort == "name_asc":
        stmt = stmt.order_by(User.last_name.asc(), User.first_name.asc())
    elif sort == "name_desc":
        stmt = stmt.order_by(User.last_name.desc(), User.first_name.desc())
    else:
        stmt = stmt.order_by(User.created_at.desc())

    # Paging not used effectively (size very large) as per spec: show all
    stmt = stmt.options(selectinload(User.certificate))
    users = db.scalars(stmt).all()
    founder_email = (settings.founder_admin_email or "").lower()

    user_ids = [u.id for u in users]
    unseen_counts: dict[int, int] = {}
    if user_ids:
        stmt = (
            select(Statement.user_id, func.count())
            .where(
                Statement.user_id.in_(user_ids),
                Statement.seen_at.is_(None),
            )
            .group_by(Statement.user_id)
        )
        for user_id, count in db.execute(stmt):
            unseen_counts[int(user_id)] = int(count)

    items = []
    for u in users:
        unseen_count = unseen_counts.get(u.id, 0)
        cert_data = None
        if u.certificate:
            cert_data = {
                "id": u.certificate.id,
                "issuedAt": u.certificate.issued_at,
                "expiresAt": u.certificate.expires_at,
            }
        items.append(
            UserOut(
                id=u.id,
                firstName=u.first_name or "",
                lastName=u.last_name or "",
                email=u.email or "",
                phone=u.phone or "",
                personalId=u.personal_id or "",
                code=u.code or "",
                isAdmin=u.is_admin,
                isFounder=_is_founder_actor(u.email),
                createdAt=u.created_at,
                unseenStatementsCount=unseen_count,
                certificate=cert_data,
            )
        )

    return UsersListResponse(users=items, total=len(items))


@router.put("/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: int = Path(...),
    payload: AdminUserUpdateRequest = ...,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    user_email = (user.email or "").lower()

    if payload.firstName is not None:
        user.first_name = payload.firstName
    if payload.lastName is not None:
        user.last_name = payload.lastName
    if payload.email is not None:
        new_email = payload.email.strip().lower()
        if new_email != user_email:
            existing = db.scalar(select(User).where(func.lower(User.email) == new_email))
            if existing and existing.id != user_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
            user.email = new_email
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.personalId is not None:
        user.personal_id = payload.personalId
    if payload.code is not None:
        user.code = payload.code
    if payload.isAdmin is not None:
        if user_email == founder_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot modify founder admin status")
        user.is_admin = payload.isAdmin

    db.add(user)
    db.commit()
    db.refresh(user)

    unseen_count = db.scalar(
        select(func.count()).select_from(Statement).where(Statement.user_id == user_id, Statement.seen_at.is_(None))
    ) or 0

    cert_data = None
    if user.certificate:
        cert_data = {
            "id": user.certificate.id,
            "issuedAt": user.certificate.issued_at,
            "expiresAt": user.certificate.expires_at,
        }

    return UserOut(
        id=user.id,
        firstName=user.first_name or "",
        lastName=user.last_name or "",
        email=user.email or "",
        phone=user.phone or "",
        personalId=user.personal_id or "",
        code=user.code or "",
        isAdmin=user.is_admin,
        isFounder=_is_founder_actor(user.email),
        createdAt=user.created_at,
        unseenStatementsCount=unseen_count,
        certificate=cert_data,
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    user_email = (user.email or "").lower()

    if user_email == founder_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete founder")

    db.delete(user)
    db.commit()
    return


@router.delete("/users", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_users(
    user_ids: list[int] = Query(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()

    users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
    for user in users:
        user_email = (user.email or "").lower()
        if user_email == founder_email:
            continue  # Skip founder
        db.delete(user)
    db.commit()
    return


@router.get("/users/{user_id}/statements", response_model=AdminStatementsResponse)
def admin_user_statements(
    user_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    statements = db.scalars(select(Statement).where(Statement.user_id == user_id).order_by(Statement.created_at.desc())).all()
    items = []
    for st in statements:
        items.append(
            AdminStatementOut(
                id=st.id,
                message=st.message,
                attachmentFilename=st.attachment_filename,
                seenAt=st.seen_at,
                seenBy=st.seen_by,
                createdAt=st.created_at,
            )
        )

    return AdminStatementsResponse(statements=items, total=len(items))


@router.delete("/statements/{statement_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_statement(
    statement_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    st = db.get(Statement, statement_id)
    if not st:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Statement not found")

    if st.attachment_path:
        try:
            path = resolve_storage_path(st.attachment_path)
            if path.exists():
                path.unlink()
        except Exception:
            pass

    db.delete(st)
    db.commit()
    return


@router.get("/statements/summary")
def admin_statements_summary(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    total_unseen = db.scalar(
        select(func.count()).select_from(Statement).where(Statement.seen_at.is_(None))
    ) or 0
    return {"has_unseen": total_unseen > 0, "unseen_total": total_unseen}


@router.post("/statements/mark-seen", status_code=status.HTTP_204_NO_CONTENT)
def admin_mark_statements_seen(
    payload: StatementSeenRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    now = datetime.now(timezone.utc)
    actor_email = _actor_email_normalized(x_actor_email)
    statement_ids = payload.statement_ids or []
    if not statement_ids:
        return
    db.execute(
        Statement.__table__.update()
        .where(Statement.id.in_(statement_ids))
        .values(seen_at=now, seen_by=actor_email)
    )
    db.commit()
    return


# ================= Project Evaluation Admin Endpoints =================

def _ensure_project_pdf_dir() -> Path:
    """Ensure and return the directory for storing project PDFs."""
    root = ensure_media_root()
    pdf_dir = root / "project_evaluation" / "pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    return pdf_dir


@router.get("/project-evaluation/projects", response_model=AdminProjectEvaluationProjectsListResponse)
def admin_project_evaluation_projects(
    project_type: str | None = Query(None),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    stmt = select(ProjectEvaluationProject)
    if project_type:
        stmt = stmt.where(ProjectEvaluationProject.project_type == project_type)
    stmt = stmt.order_by(ProjectEvaluationProject.created_at.desc())
    
    projects = db.scalars(stmt).all()
    
    items = []
    for p in projects:
        violations_count = db.scalar(
            select(func.count()).select_from(ProjectEvaluationViolation)
            .where(ProjectEvaluationViolation.project_id == p.id)
        ) or 0
        items.append(
            AdminProjectEvaluationProjectOut(
                id=p.id,
                projectType=p.project_type,
                projectCode=p.project_code,
                pdfFilename=p.pdf_filename,
                enabled=p.enabled,
                createdAt=p.created_at,
                violationsCount=violations_count,
            )
        )
    
    return AdminProjectEvaluationProjectsListResponse(projects=items, total=len(items))


@router.post("/project-evaluation/projects", response_model=AdminProjectEvaluationProjectOut)
def admin_create_project_evaluation_project(
    project_type: str = Form(...),
    project_code: str = Form(...),
    pdf_file: UploadFile = File(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    if project_type not in {"residential", "multifunctional"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project type")
    
    # Check if project code already exists
    existing = db.scalar(
        select(ProjectEvaluationProject).where(ProjectEvaluationProject.project_code == project_code)
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project code already exists")
    
    # Validate PDF file
    if not pdf_file.filename or not pdf_file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a PDF")
    
    # Save PDF file
    pdf_dir = _ensure_project_pdf_dir()
    safe_filename = f"{project_code}_{pdf_file.filename}"
    pdf_path = pdf_dir / safe_filename
    
    with open(pdf_path, "wb") as f:
        shutil.copyfileobj(pdf_file.file, f)
    
    # Get file size
    file_size = pdf_path.stat().st_size
    
    # Create project record
    project = ProjectEvaluationProject(
        project_type=project_type,
        project_code=project_code,
        pdf_path=relative_storage_path(pdf_path),
        pdf_filename=pdf_file.filename,
        pdf_mime_type="application/pdf",
        pdf_size_bytes=file_size,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    violations_count = 0
    
    return AdminProjectEvaluationProjectOut(
        id=project.id,
        projectType=project.project_type,
        projectCode=project.project_code,
        pdfFilename=project.pdf_filename,
        enabled=project.enabled,
        createdAt=project.created_at,
        violationsCount=violations_count,
    )


@router.put("/project-evaluation/projects/{project_id}", response_model=AdminProjectEvaluationProjectOut)
def admin_update_project_evaluation_project(
    project_id: int = Path(...),
    payload: AdminProjectEvaluationProjectUpdate = ...,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    project = db.get(ProjectEvaluationProject, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if payload.project_code is not None:
        # Check if new code already exists
        existing = db.scalar(
            select(ProjectEvaluationProject)
            .where(ProjectEvaluationProject.project_code == payload.project_code, ProjectEvaluationProject.id != project_id)
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project code already exists")
        project.project_code = payload.project_code
    
    if payload.enabled is not None:
        project.enabled = payload.enabled
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    violations_count = db.scalar(
        select(func.count()).select_from(ProjectEvaluationViolation)
        .where(ProjectEvaluationViolation.project_id == project.id)
    ) or 0
    
    return AdminProjectEvaluationProjectOut(
        id=project.id,
        projectType=project.project_type,
        projectCode=project.project_code,
        pdfFilename=project.pdf_filename,
        enabled=project.enabled,
        createdAt=project.created_at,
        violationsCount=violations_count,
    )


@router.delete("/project-evaluation/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_project_evaluation_project(
    project_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    project = db.get(ProjectEvaluationProject, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Delete PDF file
    try:
        pdf_path = resolve_storage_path(project.pdf_path)
        if pdf_path.exists():
            pdf_path.unlink()
    except Exception:
        pass  # Continue even if file deletion fails
    
    db.delete(project)
    db.commit()
    return


@router.get("/project-evaluation/projects/{project_id}/violations", response_model=AdminProjectEvaluationViolationsListResponse)
def admin_project_evaluation_violations(
    project_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    project = db.get(ProjectEvaluationProject, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    violations = db.scalars(
        select(ProjectEvaluationViolation)
        .where(ProjectEvaluationViolation.project_id == project_id)
        .order_by(ProjectEvaluationViolation.order_index, ProjectEvaluationViolation.id)
    ).all()
    
    items = []
    for v in violations:
        items.append(
            AdminProjectEvaluationViolationOut(
                id=v.id,
                projectId=v.project_id,
                description=v.description,
                isCorrect=v.is_correct,
                orderIndex=v.order_index,
                enabled=v.enabled,
                createdAt=v.created_at,
            )
        )
    
    return AdminProjectEvaluationViolationsListResponse(violations=items, total=len(items))


@router.post("/project-evaluation/projects/{project_id}/violations", response_model=AdminProjectEvaluationViolationOut)
def admin_create_project_evaluation_violation(
    project_id: int = Path(...),
    payload: AdminProjectEvaluationViolationCreate = ...,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    project = db.get(ProjectEvaluationProject, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    # Get max order_index for this project
    max_order = db.scalar(
        select(func.max(ProjectEvaluationViolation.order_index))
        .where(ProjectEvaluationViolation.project_id == project_id)
    ) or 0
    
    order_index = payload.order_index if payload.order_index is not None else max_order + 1
    
    violation = ProjectEvaluationViolation(
        project_id=project_id,
        description=payload.description,
        is_correct=payload.is_correct,
        order_index=order_index,
    )
    db.add(violation)
    db.commit()
    db.refresh(violation)
    
    return AdminProjectEvaluationViolationOut(
        id=violation.id,
        projectId=violation.project_id,
        description=violation.description,
        isCorrect=violation.is_correct,
        orderIndex=violation.order_index,
        enabled=violation.enabled,
        createdAt=violation.created_at,
    )


@router.put("/project-evaluation/violations/{violation_id}", response_model=AdminProjectEvaluationViolationOut)
def admin_update_project_evaluation_violation(
    violation_id: int = Path(...),
    payload: AdminProjectEvaluationViolationUpdate = ...,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    violation = db.get(ProjectEvaluationViolation, violation_id)
    if not violation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    
    if payload.description is not None:
        violation.description = payload.description
    if payload.is_correct is not None:
        violation.is_correct = payload.is_correct
    if payload.order_index is not None:
        violation.order_index = payload.order_index
    if payload.enabled is not None:
        violation.enabled = payload.enabled
    
    db.add(violation)
    db.commit()
    db.refresh(violation)
    
    return AdminProjectEvaluationViolationOut(
        id=violation.id,
        projectId=violation.project_id,
        description=violation.description,
        isCorrect=violation.is_correct,
        orderIndex=violation.order_index,
        enabled=violation.enabled,
        createdAt=violation.created_at,
    )


@router.delete("/project-evaluation/violations/{violation_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_project_evaluation_violation(
    violation_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    violation = db.get(ProjectEvaluationViolation, violation_id)
    if not violation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Violation not found")
    
    db.delete(violation)
    db.commit()
    return


@router.get("/project-evaluation/settings/{project_type}", response_model=AdminProjectEvaluationSettingsOut)
def admin_get_project_evaluation_settings(
    project_type: str = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    if project_type not in {"residential", "multifunctional"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project type")
    
    settings = db.scalar(
        select(ProjectEvaluationSettings).where(ProjectEvaluationSettings.project_type == project_type)
    )
    if not settings:
        # Create default settings
        settings = ProjectEvaluationSettings(
            project_type=project_type,
            duration_minutes=60,
            gate_password="cpig",
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return AdminProjectEvaluationSettingsOut(
        projectType=settings.project_type,
        durationMinutes=settings.duration_minutes,
        gatePassword=settings.gate_password,
    )


@router.put("/project-evaluation/settings/{project_type}", response_model=AdminProjectEvaluationSettingsOut)
def admin_update_project_evaluation_settings(
    project_type: str = Path(...),
    payload: AdminProjectEvaluationSettingsUpdate = ...,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    if project_type not in {"residential", "multifunctional"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project type")
    
    settings = db.scalar(
        select(ProjectEvaluationSettings).where(ProjectEvaluationSettings.project_type == project_type)
    )
    if not settings:
        settings = ProjectEvaluationSettings(project_type=project_type, duration_minutes=60, gate_password="cpig")
        db.add(settings)
    
    if payload.duration_minutes is not None:
        settings.duration_minutes = payload.duration_minutes
    if payload.gate_password is not None:
        settings.gate_password = payload.gate_password
    
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    return AdminProjectEvaluationSettingsOut(
        projectType=settings.project_type,
        durationMinutes=settings.duration_minutes,
        gatePassword=settings.gate_password,
    )


@router.get("/project-evaluation/sessions", response_model=AdminProjectEvaluationSessionsListResponse)
def admin_project_evaluation_sessions(
    project_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=1000),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    
    stmt = select(ProjectEvaluationSession)
    if project_type:
        stmt = stmt.where(ProjectEvaluationSession.project_type == project_type)
    stmt = stmt.order_by(ProjectEvaluationSession.started_at.desc())
    
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    
    offset = (page - 1) * size
    sessions = db.scalars(stmt.offset(offset).limit(size)).all()
    
    items = []
    for s in sessions:
        project_code = None
        if s.project_id:
            project = db.get(ProjectEvaluationProject, s.project_id)
            if project:
                project_code = project.project_code
        
        items.append(
            AdminProjectEvaluationSessionOut(
                id=s.id,
                projectType=s.project_type,
                projectId=s.project_id,
                projectCode=project_code,
                startedAt=s.started_at,
                finishedAt=s.finished_at,
                active=s.active,
                correctViolationsCount=s.correct_violations_count,
                incorrectViolationsCount=s.incorrect_violations_count,
                totalViolationsCount=s.total_violations_count,
                scorePercent=s.score_percent,
            )
        )
    
    return AdminProjectEvaluationSessionsListResponse(sessions=items, total=total)
