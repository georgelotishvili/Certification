from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status, Path
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Block, Question, Session as ExamSession, Answer, Option, Question as Q, User, Exam
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
    AnswerDetail,
    UsersListResponse,
    UserOut,
    ToggleAdminRequest,
)


router = APIRouter()


def _require_admin(x_admin_key: str | None) -> None:
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")


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
        gate_password=exam.gate_password or "",
    )


def _blocks_payload(exam: Exam) -> AdminBlocksResponse:
    ordered_blocks = sorted(exam.blocks, key=lambda b: (b.order_index or 0, b.id))
    blocks: list[AdminBlockPayload] = []
    for block_index, block in enumerate(ordered_blocks, start=1):
        ordered_questions = sorted(block.questions, key=lambda q: (q.order_index or 0, q.id))
        question_payloads: list[AdminQuestionPayload] = []
        for question_index, question in enumerate(ordered_questions, start=1):
            options = sorted(question.options, key=lambda o: o.id)
            answers = [
                AdminAnswerPayload(id=str(option.id), text=option.text)
                for option in options
            ]
            correct_id = next((str(option.id) for option in options if option.is_correct), None)
            question_payloads.append(
                AdminQuestionPayload(
                    id=str(question.id),
                    text=question.text,
                    code=question.code,
                    answers=answers,
                    correct_answer_id=correct_id,
                    enabled=question.enabled,
                )
            )
        blocks.append(
            AdminBlockPayload(
                id=str(block.id),
                number=block.order_index or block_index,
                name=block.title,
                qty=block.qty,
                enabled=block.enabled,
                questions=question_payloads,
            )
        )
    return AdminBlocksResponse(exam_id=exam.id, blocks=blocks)


@router.get("/exam/settings", response_model=ExamSettingsResponse)
def get_exam_settings(
    exam_id: int | None = None,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key)
    exam = _get_or_create_exam(db, exam_id)
    return _exam_settings_payload(exam)


@router.put("/exam/settings", response_model=ExamSettingsResponse)
def update_exam_settings(
    payload: ExamSettingsUpdateRequest,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key)
    exam = _get_or_create_exam(db, payload.exam_id)

    if payload.title is not None:
        candidate = payload.title.strip()
        if candidate:
            exam.title = candidate

    if payload.duration_minutes is not None:
        duration = max(1, payload.duration_minutes)
        exam.duration_minutes = duration

    if payload.gate_password is not None:
        exam.gate_password = payload.gate_password.strip()

    db.add(exam)
    db.commit()
    db.refresh(exam)
    return _exam_settings_payload(exam)


@router.get("/exam/blocks", response_model=AdminBlocksResponse)
def get_exam_blocks(
    exam_id: int | None = None,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key)
    exam = _get_or_create_exam(db, exam_id)
    return _blocks_payload(exam)


@router.put("/exam/blocks", response_model=AdminBlocksResponse)
def update_exam_blocks(
    payload: AdminBlocksUpdateRequest,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    _require_admin(x_admin_key)
    exam = _get_or_create_exam(db, payload.exam_id)

    existing_blocks = db.scalars(select(Block).where(Block.exam_id == exam.id)).all()
    for block in existing_blocks:
        db.delete(block)
    db.flush()

    for block_index, block_payload in enumerate(payload.blocks or [], start=1):
        questions_payload = block_payload.questions or []
        qty = max(0, min(block_payload.qty, len(questions_payload)))
        block = Block(
            exam_id=exam.id,
            title=(block_payload.name or "").strip() or f"ბლოკი {block_index}",
            qty=qty,
            order_index=block_payload.number or block_index,
            enabled=block_payload.enabled,
        )
        db.add(block)
        db.flush()

        for question_index, question_payload in enumerate(questions_payload, start=1):
            question = Question(
                block_id=block.id,
                code=question_payload.code or f"Q-{block.id}-{question_index}",
                text=(question_payload.text or "").strip(),
                order_index=question_index,
                enabled=question_payload.enabled,
            )
            db.add(question)
            db.flush()

            created_options: list[Option] = []
            for answer_payload in question_payload.answers:
                option = Option(
                    question_id=question.id,
                    text=(answer_payload.text or "").strip(),
                    is_correct=str(answer_payload.id) == str(question_payload.correct_answer_id)
                    if question_payload.correct_answer_id is not None
                    else False,
                )
                db.add(option)
                created_options.append(option)
            db.flush()

            if not any(opt.is_correct for opt in question.options):
                if created_options:
                    created_options[0].is_correct = True
                    db.add(created_options[0])

    db.commit()
    refreshed_exam = _get_or_create_exam(db, exam.id)
    return _blocks_payload(refreshed_exam)


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


# Results list
@router.get("/results", response_model=ResultListResponse)
def results_list(
    page: int = 1,
    size: int = 50,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")
    offset = max(0, (page - 1) * size)
    q = select(ExamSession).order_by(ExamSession.started_at.desc()).offset(offset).limit(size)
    sessions = db.scalars(q).all()
    total = db.scalar(select(func.count()).select_from(ExamSession)) or 0
    items = [
        ResultListItem(
            session_id=s.id,
            started_at=s.started_at,
            finished_at=s.finished_at,
            candidate_first_name=s.candidate_first_name,
            candidate_last_name=s.candidate_last_name,
            candidate_code=s.candidate_code,
            score_percent=s.score_percent or 0.0,
        )
        for s in sessions
    ]
    return ResultListResponse(items=items, total=total)


# Result details
@router.get("/results/{session_id}", response_model=ResultDetailResponse)
def result_detail(
    session_id: int = Path(...),
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")
    s = db.get(ExamSession, session_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    stmt = (
        select(Answer, Option, Q)
        .join(Option, Option.id == Answer.option_id)
        .join(Q, Q.id == Answer.question_id)
        .where(Answer.session_id == s.id)
        .order_by(Q.order_index)
    )
    rows = db.execute(stmt).all()
    answers = [
        AnswerDetail(
            question_id=q.id,
            question_code=q.code,
            question_text=q.text,
            option_id=o.id,
            option_text=o.text,
            is_correct=a.is_correct,
            answered_at=a.answered_at,
        )
        for (a, o, q) in rows
    ]
    sess_item = ResultListItem(
        session_id=s.id,
        started_at=s.started_at,
        finished_at=s.finished_at,
        candidate_first_name=s.candidate_first_name,
        candidate_last_name=s.candidate_last_name,
        candidate_code=s.candidate_code,
        score_percent=s.score_percent or 0.0,
    )
    import json as _json
    block_stats = []
    try:
        block_stats = _json.loads(s.block_stats or "[]")
    except Exception:
        block_stats = []
    return ResultDetailResponse(session=sess_item, block_stats=block_stats, answers=answers)



# ================= Users admin endpoints =================

@router.get("/users", response_model=UsersListResponse)
def admin_users(
    page: int = 1,
    size: int = 1000000,
    search: str | None = None,
    only_admins: bool = False,
    sort: str = "date_desc",  # date_desc|date_asc|name_asc|name_desc
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")

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
    users = db.scalars(stmt).all()
    founder_email = (settings.founder_admin_email or "").lower()

    items = [
        UserOut(
            id=u.id,
            personal_id=u.personal_id,
            first_name=u.first_name,
            last_name=u.last_name,
            phone=u.phone,
            email=u.email,
            code=u.code,
            is_admin=(u.email.lower() == founder_email) or bool(u.is_admin),
            is_founder=(u.email.lower() == founder_email),
            created_at=u.created_at,
        )
        for u in users
    ]
    return UsersListResponse(items=items, total=len(items))


@router.patch("/users/{user_id}/admin", status_code=status.HTTP_204_NO_CONTENT)
def admin_toggle_user(
    user_id: int,
    payload: ToggleAdminRequest,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")
    if (settings.founder_admin_email or "").lower() != (x_actor_email or "").lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founder can modify admin status")

    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if (settings.founder_admin_email or "").lower() == u.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Founder admin cannot be modified")

    u.is_admin = bool(payload.is_admin)
    db.add(u)
    db.commit()
    return


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_user(
    user_id: int,
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")
    if (settings.founder_admin_email or "").lower() != (x_actor_email or "").lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founder can delete")

    u = db.get(User, user_id)
    if not u:
        return
    if (settings.founder_admin_email or "").lower() == u.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Founder admin cannot be deleted")

    db.delete(u)
    db.commit()
    return


# Bulk delete all non-founder users
@router.delete("/users", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_all_users(
    x_admin_key: str | None = Header(None, alias="x-admin-key"),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")
    # Only founder can delete all users
    founder_email = (settings.founder_admin_email or "").lower()
    if founder_email != (x_actor_email or "").lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founder can delete all users")

    # Do not delete founder
    from sqlalchemy import select
    users = db.scalars(select(User)).all()  # fetch all users
    for u in users:
        if (u.email or "").lower() == founder_email:
            continue
        db.delete(u)
    db.commit()
    return