from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status, Path, Response, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_db
from ..models import Block, ExamMedia, Question, Session as ExamSession, Answer, Option, Question as Q, User, Exam
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
    BlockStatDetail,
    UsersListResponse,
    UserOut,
    ToggleAdminRequest,
)
from ..services.media_storage import resolve_storage_path


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


@router.get("/auth/verify", status_code=status.HTTP_204_NO_CONTENT)
def verify_admin_access(
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
) -> Response:
    _require_admin(db, x_actor_email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/exam/settings", response_model=ExamSettingsResponse)
def get_exam_settings(
    exam_id: int | None = None,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db, exam_id)
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
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db, exam_id)
    return _blocks_payload(exam)


@router.put("/exam/blocks", response_model=AdminBlocksResponse)
def update_exam_blocks(
    payload: AdminBlocksUpdateRequest,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    exam = _get_or_create_exam(db, payload.exam_id)

    existing_blocks = db.scalars(
        select(Block)
        .where(Block.exam_id == exam.id)
        .options(
            selectinload(Block.questions).selectinload(Question.options),
            selectinload(Block.questions).selectinload(Question.answers),
        )
    ).all()

    block_index_default = 0
    processed_block_ids: set[int] = set()
    block_by_id = {str(block.id): block for block in existing_blocks}

    def _parse_int(value: str | int | None) -> int | None:
        try:
            if value is None:
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    for block_index, block_payload in enumerate(payload.blocks or [], start=1):
        questions_payload = block_payload.questions or []
        qty = max(0, min(block_payload.qty, len(questions_payload)))

        block_id_int = _parse_int(block_payload.id)
        if block_id_int is not None and str(block_id_int) in block_by_id:
            block = block_by_id[str(block_id_int)]
        else:
            block = Block(exam_id=exam.id)
            db.add(block)
            db.flush()
            exam.blocks.append(block)
            block_by_id[str(block.id)] = block

        block_index_default += 1
        block.title = (block_payload.name or "").strip() or f"ბლოკი {block_index_default}"
        block.qty = qty
        block.order_index = block_payload.number or block_index_default
        block.enabled = block_payload.enabled
        processed_block_ids.add(block.id)

        existing_questions = {str(question.id): question for question in block.questions}
        processed_question_ids: set[int] = set()

        for question_index, question_payload in enumerate(questions_payload, start=1):
            question_id_int = _parse_int(question_payload.id)
            if question_id_int is not None and str(question_id_int) in existing_questions:
                question = existing_questions[str(question_id_int)]
            else:
                question = Question(block_id=block.id)
                db.add(question)
                db.flush()
                block.questions.append(question)
                existing_questions[str(question.id)] = question

            question.code = question_payload.code or f"Q-{block.id}-{question_index}"
            question.text = (question_payload.text or "").strip()
            question.order_index = question_index
            question.enabled = question_payload.enabled
            processed_question_ids.add(question.id)

            existing_options = {str(option.id): option for option in question.options}
            processed_option_ids: set[int] = set()

            for answer_payload in question_payload.answers or []:
                option_id_int = _parse_int(answer_payload.id)
                if option_id_int is not None and str(option_id_int) in existing_options:
                    option = existing_options[str(option_id_int)]
                else:
                    option = Option(question_id=question.id)
                    db.add(option)
                    db.flush()
                    question.options.append(option)
                    existing_options[str(option.id)] = option

                option.text = (answer_payload.text or "").strip()
                option.is_correct = (
                    str(answer_payload.id) == str(question_payload.correct_answer_id)
                    if question_payload.correct_answer_id is not None
                    else False
                )
                processed_option_ids.add(option.id)

            if question.options and not any(opt.is_correct for opt in question.options):
                first_option = min(question.options, key=lambda opt: opt.id)
                first_option.is_correct = True

            if existing_options:
                for option in list(existing_options.values()):
                    if option.id not in processed_option_ids:
                        has_answers = db.scalar(
                            select(func.count()).select_from(Answer).where(Answer.option_id == option.id)
                        )
                        if has_answers:
                            raise HTTPException(
                                status_code=status.HTTP_409_CONFLICT,
                                detail="ვერ წაშლით პასუხს, რადგან უკვე არსებობს შედეგები",
                            )
                        db.delete(option)

        for question in list(existing_questions.values()):
            if question.id not in processed_question_ids:
                if question.answers:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="ვერ წაშლით შეკითხვას, რადგან უკვე არსებობს შედეგები",
                    )
                db.delete(question)

    for block in existing_blocks:
        if block.id not in processed_block_ids:
            has_answers = any(question.answers for question in block.questions)
            if has_answers:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="ვერ წაშლით ბლოკს, რადგან უკვე არსებობს შედეგები",
                )
            db.delete(block)

    db.commit()
    refreshed_exam = _get_or_create_exam(db, exam.id)
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
    if session.active:
        return "in_progress"
    return "aborted"


def _build_result_item(session: ExamSession, personal_id: str | None = None) -> ResultListItem:
    return ResultListItem(
        session_id=session.id,
        started_at=session.started_at,
        finished_at=session.finished_at,
        candidate_first_name=session.candidate_first_name,
        candidate_last_name=session.candidate_last_name,
        candidate_code=session.candidate_code,
        score_percent=session.score_percent or 0.0,
        exam_id=session.exam_id,
        ends_at=session.ends_at,
        status=_session_status(session),
        personal_id=personal_id,
    )


# Results list
@router.get("/results", response_model=ResultListResponse)
def results_list(
    page: int = 1,
    size: int = 50,
    candidate_code: str | None = None,
    personal_id: str | None = None,
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    candidate_code_norm = (candidate_code or "").strip().lower() or None
    personal_id_norm = (personal_id or "").strip().lower() or None

    stmt = select(ExamSession).order_by(ExamSession.started_at.desc())

    code_filters: list[str] = []
    if personal_id_norm:
        codes_stmt = select(User.code).where(func.lower(User.personal_id) == personal_id_norm)
        codes_for_personal = [code for code in db.scalars(codes_stmt).all() if code]
        if not codes_for_personal:
            return ResultListResponse(items=[], total=0)
        code_filters.extend([code.strip().lower() for code in codes_for_personal if code])

    if candidate_code_norm:
        code_filters.append(candidate_code_norm)

    if code_filters:
        stmt = stmt.where(func.lower(ExamSession.candidate_code).in_(code_filters))

    filtered = bool(candidate_code_norm or personal_id_norm)

    if filtered:
        sessions = db.scalars(stmt).all()
        total = len(sessions)
    else:
        offset = max(0, (page - 1) * size)
        paged_stmt = stmt.offset(offset).limit(size)
        sessions = db.scalars(paged_stmt).all()
        total = db.scalar(select(func.count()).select_from(ExamSession)) or 0

    candidate_codes = {
        (s.candidate_code or "").strip().lower()
        for s in sessions
        if s.candidate_code
    }
    user_by_code: dict[str, User] = {}
    if candidate_codes:
        users = db.scalars(
            select(User).where(func.lower(User.code).in_(list(candidate_codes)))
        ).all()
        user_by_code = {
            (u.code or "").strip().lower(): u
            for u in users
            if u.code
        }

    items: list[ResultListItem] = []
    for s in sessions:
        code_key = (s.candidate_code or "").strip().lower()
        personal_id_value = user_by_code.get(code_key).personal_id if code_key in user_by_code else None
        items.append(_build_result_item(s, personal_id_value))

    return ResultListResponse(items=items, total=total)


# Result details
@router.get("/results/{session_id}", response_model=ResultDetailResponse)
def result_detail(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)
    s = db.get(ExamSession, session_id)
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    personal_id_value: str | None = None
    if s.candidate_code:
        personal_id_value = db.scalar(
            select(User.personal_id)
            .where(func.lower(User.code) == func.lower(s.candidate_code))
            .limit(1)
        )

    exam_title: str | None = None
    if s.exam_id:
        exam = db.get(Exam, s.exam_id)
        if exam:
            exam_title = exam.title

    answers = db.scalars(select(Answer).where(Answer.session_id == s.id)).all()
    answer_by_question = {ans.question_id: ans for ans in answers}

    import json as _json

    selected_map: dict[str, list[int]] = {}
    if s.selected_map:
        try:
            raw_map = _json.loads(s.selected_map)
            if isinstance(raw_map, dict):
                for key, value in raw_map.items():
                    try:
                        int_key = int(key)
                    except (TypeError, ValueError):
                        continue
                    cleaned: list[int] = []
                    for item in value or []:
                        try:
                            cleaned.append(int(item))
                        except (TypeError, ValueError):
                            continue
                    selected_map[str(int_key)] = cleaned
        except Exception:
            selected_map = {}

    ordered_question_ids: list[int] = []
    for _, qids in selected_map.items():
        for qid in qids:
            if qid not in ordered_question_ids:
                ordered_question_ids.append(qid)

    answers_sorted = sorted(answers, key=lambda a: a.answered_at or s.started_at)
    if not ordered_question_ids:
        ordered_question_ids = [ans.question_id for ans in answers_sorted]

    question_ids = set(ordered_question_ids) | {ans.question_id for ans in answers}
    questions = (
        db.scalars(select(Q).where(Q.id.in_(question_ids))).all()
        if question_ids
        else []
    )
    question_map = {q.id: q for q in questions}

    block_ids = {q.block_id for q in questions}
    for key in selected_map.keys():
        try:
            block_ids.add(int(key))
        except (TypeError, ValueError):
            continue

    blocks = (
        db.scalars(select(Block).where(Block.id.in_(block_ids))).all()
        if block_ids
        else []
    )
    block_map = {b.id: b for b in blocks}

    options = (
        db.scalars(select(Option).where(Option.question_id.in_(question_ids))).all()
        if question_ids
        else []
    )
    options_by_id = {opt.id: opt for opt in options}
    correct_option_map: dict[int, Option] = {}
    for opt in options:
        if opt.is_correct:
            correct_option_map[opt.question_id] = opt

    question_sequence: list[int] = []
    seen_questions: set[int] = set()
    for qid in ordered_question_ids:
        if qid not in seen_questions:
            question_sequence.append(qid)
            seen_questions.add(qid)
    for ans in answers_sorted:
        if ans.question_id not in seen_questions:
            question_sequence.append(ans.question_id)
            seen_questions.add(ans.question_id)

    block_sequence: list[int] = []
    seen_blocks: set[int] = set()
    for key in selected_map.keys():
        try:
            block_id = int(key)
        except (TypeError, ValueError):
            continue
        if block_id not in seen_blocks:
            block_sequence.append(block_id)
            seen_blocks.add(block_id)
    if not block_sequence and block_map:
        block_sequence = [
            b.id for b in sorted(block_map.values(), key=lambda blk: ((blk.order_index or 0), blk.id))
        ]
        seen_blocks = set(block_sequence)
    for block_id in block_ids:
        if block_id not in seen_blocks:
            block_sequence.append(block_id)
            seen_blocks.add(block_id)

    raw_block_stats = []
    if s.block_stats:
        try:
            raw_block_stats = _json.loads(s.block_stats)
        except Exception:
            raw_block_stats = []
    raw_block_map = {}
    for entry in raw_block_stats:
        if not isinstance(entry, dict):
            continue
        try:
            block_id = int(entry.get("block_id"))
        except (TypeError, ValueError):
            continue
        raw_block_map[block_id] = entry

    block_stats_payload: list[BlockStatDetail] = []
    for block_id in block_sequence:
        entry = raw_block_map.get(block_id)
        if entry:
            total = int(entry.get("total", 0) or 0)
            correct = int(entry.get("correct", 0) or 0)
            percent = float(entry.get("percent", 0.0) or 0.0)
        else:
            question_ids_in_block = selected_map.get(str(block_id), [])
            if not question_ids_in_block and block_id in block_map:
                question_ids_in_block = [
                    q.id for q in question_map.values() if q.block_id == block_id
                ]
            total = len(question_ids_in_block)
            answers_for_block = [
                answer_by_question[qid]
                for qid in question_ids_in_block
                if qid in answer_by_question
            ]
            correct = sum(1 for ans in answers_for_block if ans.is_correct)
            percent = round((correct / total) * 100.0, 2) if total else 0.0

        block_stats_payload.append(
            BlockStatDetail(
                block_id=block_id,
                block_title=block_map.get(block_id).title if block_id in block_map else None,
                total=total,
                correct=correct,
                percent=percent,
            )
        )

    answers_payload: list[AnswerDetail] = []
    for qid in question_sequence:
        question = question_map.get(qid)
        if not question:
            continue
        answer = answer_by_question.get(qid)
        selected_option = options_by_id.get(answer.option_id) if answer else None
        correct_option = correct_option_map.get(qid)
        block = block_map.get(question.block_id)
        answers_payload.append(
            AnswerDetail(
                question_id=question.id,
                question_code=question.code,
                question_text=question.text,
                block_id=question.block_id,
                block_title=block.title if block else None,
                selected_option_id=selected_option.id if selected_option else None,
                selected_option_text=selected_option.text if selected_option else None,
                is_correct=answer.is_correct if answer else None,
                answered_at=answer.answered_at if answer else None,
                correct_option_id=correct_option.id if correct_option else None,
                correct_option_text=correct_option.text if correct_option else None,
            )
        )

    total_questions = len(question_sequence)
    answered_questions = sum(1 for qid in question_sequence if qid in answer_by_question)
    correct_answers = sum(1 for ans in answer_by_question.values() if ans.is_correct)

    session_payload = _build_result_item(s, personal_id_value)

    return ResultDetailResponse(
        session=session_payload,
        exam_title=exam_title,
        total_questions=total_questions,
        answered_questions=answered_questions,
        correct_answers=correct_answers,
        block_stats=block_stats_payload,
        answers=answers_payload,
    )


@router.get("/results/{session_id}/media", response_model=ResultMediaResponse)
def result_media_meta(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    actor: str | None = Query(None, alias="actor"),
    db: Session = Depends(get_db),
):
    _require_admin(db, actor or x_actor_email)
    records = db.scalars(select(ExamMedia).where(ExamMedia.session_id == session_id)).all()
    media_map: dict[str, ExamMedia] = {}
    for record in records:
        media_type = (record.media_type or "camera").strip().lower()
        if media_type not in MEDIA_TYPES:
            continue
        if media_type not in media_map or media_map[media_type].updated_at <= record.updated_at:
            media_map[media_type] = record

    items: list[ResultMediaItem] = []
    for media_type in MEDIA_TYPES:
        record = media_map.get(media_type)
        available = bool(record and record.completed)
        download_url = (
            f"/admin/results/{session_id}/media/file?media_type={media_type}"
            if available
            else None
        )
        items.append(
            ResultMediaItem(
                media_type=media_type,
                available=available,
                download_url=download_url,
                filename=record.filename if record else None,
                mime_type=record.mime_type if record else None,
                size_bytes=record.size_bytes if record else None,
                duration_seconds=record.duration_seconds if record else None,
                updated_at=record.updated_at if record else None,
            )
        )

    return ResultMediaResponse(items=items)


@router.get("/results/{session_id}/media/file")
def result_media_file(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    actor: str | None = Query(None, alias="actor"),
    media_type: str = Query("camera", alias="media_type"),
    db: Session = Depends(get_db),
):
    _require_admin(db, actor or x_actor_email)
    media_type_norm = (media_type or "camera").strip().lower()
    if media_type_norm not in MEDIA_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid media type")

    media = db.scalar(
        select(ExamMedia).where(
            ExamMedia.session_id == session_id,
            ExamMedia.media_type == media_type_norm,
        )
    )
    if not media and media_type_norm == "camera":
        # Backwards compatibility for legacy rows without media_type set
        media = db.scalar(
            select(ExamMedia).where(
                ExamMedia.session_id == session_id,
                (ExamMedia.media_type.is_(None)),
            )
        )
    if not media or not media.completed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    try:
        path = resolve_storage_path(media.storage_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found") from exc

    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file missing")

    return FileResponse(
        path,
        media_type=media.mime_type or "video/webm",
        filename=media.filename or path.name,
    )


@router.delete("/results/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_result(
    session_id: int = Path(...),
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    _require_admin(db, x_actor_email)

    settings = get_settings()
    founder_email = (settings.founder_admin_email or "").lower()
    if founder_email != (x_actor_email or "").lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founder can delete results")

    session_obj = db.get(ExamSession, session_id)
    if not session_obj:
        return
    db.delete(session_obj)
    db.commit()
    return



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
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
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
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
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
    x_actor_email: str | None = Header(None, alias="x-actor-email"),
    db: Session = Depends(get_db),
):
    settings = get_settings()
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