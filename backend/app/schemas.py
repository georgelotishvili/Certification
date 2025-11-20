from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic import EmailStr


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    qty: int
    order_index: int


class ExamConfigResponse(BaseModel):
    exam_id: int
    title: str
    duration_minutes: int
    blocks: List[BlockOut]


class ExamSettingsResponse(CamelModel):
    exam_id: int
    title: str
    duration_minutes: int
    gate_password: str


class ExamSettingsUpdateRequest(CamelModel):
    exam_id: Optional[int] = None
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    gate_password: Optional[str] = None


class AdminAnswerPayload(CamelModel):
    id: str
    text: str


class AdminQuestionPayload(CamelModel):
    id: str
    text: str
    code: str
    answers: List[AdminAnswerPayload]
    correct_answer_id: Optional[str] = None
    enabled: bool = True


class AdminBlockPayload(CamelModel):
    id: str
    number: int
    name: str
    qty: int
    enabled: bool = True
    questions: List[AdminQuestionPayload]


class AdminBlocksResponse(CamelModel):
    exam_id: int
    blocks: List[AdminBlockPayload]


class AdminBlocksUpdateRequest(CamelModel):
    exam_id: Optional[int] = None
    blocks: List[AdminBlockPayload]


class AuthCodeRequest(BaseModel):
    exam_id: int
    code: str


class AuthCodeResponse(BaseModel):
    session_id: int
    token: str
    exam_id: int
    duration_minutes: int
    ends_at: datetime


# Session start without code (admin-started)
class StartSessionRequest(BaseModel):
    exam_id: int
    candidate_first_name: str
    candidate_last_name: str
    candidate_code: str


class StartSessionResponse(BaseModel):
    session_id: int
    token: str
    exam_id: int
    duration_minutes: int
    ends_at: datetime


class OptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    text: str


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    text: str
    order_index: int
    options: List[OptionOut]


class QuestionsResponse(BaseModel):
    block_id: int
    block_title: str
    qty: int
    questions: List[QuestionOut]


class AnswerRequest(BaseModel):
    question_id: int
    option_id: int


class AnswerResponse(BaseModel):
    correct: bool


class FinishResponse(BaseModel):
    total_questions: int
    answered: int
    correct: int
    score_percent: float
    block_stats: List[dict]


class MediaUploadResponse(BaseModel):
    next_chunk_index: int
    completed: bool


class ExamGateVerifyRequest(BaseModel):
    exam_id: int
    password: str


class ExamGateVerifyResponse(BaseModel):
    valid: bool


class AdminStatsResponse(BaseModel):
    total_blocks: int
    total_questions: int
    enabled_blocks: int
    enabled_questions: int


# Admin results list/detail
class ResultListItem(BaseModel):
    session_id: int
    started_at: datetime
    finished_at: datetime | None
    candidate_first_name: str | None
    candidate_last_name: str | None
    candidate_code: str | None
    score_percent: float
    exam_id: int | None = None
    ends_at: datetime | None = None
    status: str = "unknown"
    personal_id: str | None = None


class ResultListResponse(BaseModel):
    items: List[ResultListItem]
    total: int


class AnswerOptionDetail(BaseModel):
    option_id: int
    option_text: str
    is_correct: bool
    is_selected: bool


class AnswerDetail(BaseModel):
    question_id: int
    question_code: str
    question_text: str
    block_id: int | None = None
    block_title: str | None = None
    selected_option_id: int | None = None
    selected_option_text: str | None = None
    is_correct: bool | None = None
    answered_at: datetime | None = None
    correct_option_id: int | None = None
    correct_option_text: str | None = None
    options: List[AnswerOptionDetail] = Field(default_factory=list)


class BlockStatDetail(BaseModel):
    block_id: int
    block_title: str | None = None
    total: int
    correct: int
    percent: float


class ResultDetailResponse(BaseModel):
    session: ResultListItem
    exam_title: str | None = None
    total_questions: int
    answered_questions: int
    correct_answers: int
    block_stats: List[BlockStatDetail]
    answers: List[AnswerDetail]


class ResultMediaItem(BaseModel):
    media_type: str
    available: bool
    download_url: str | None = None
    filename: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    duration_seconds: int | None = None
    updated_at: datetime | None = None


class ResultMediaResponse(BaseModel):
    items: List[ResultMediaItem]


# Users (registration and admin listing)
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    personal_id: str
    first_name: str
    last_name: str
    phone: str
    email: str
    code: str
    is_admin: bool
    is_founder: bool = False
    created_at: datetime
    has_unseen_statements: bool | None = None
    unseen_statement_count: int | None = None
    certificate: dict | None = None
    certificate_info: dict | None = None


class UserCreate(BaseModel):
    personal_id: str
    first_name: str
    last_name: str
    phone: str
    email: EmailStr
    password: str


class UsersListResponse(BaseModel):
    items: List[UserOut]
    total: int


class StatementCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class StatementOut(BaseModel):
    id: int
    message: str
    created_at: datetime


class AdminStatementOut(BaseModel):
    id: int
    user_id: int
    user_first_name: str | None = None
    user_last_name: str | None = None
    user_email: str | None = None
    message: str
    created_at: datetime
    seen_at: datetime | None = None
    seen_by: str | None = None


class AdminStatementsResponse(BaseModel):
    items: List[AdminStatementOut]
    total: int


class StatementSeenRequest(BaseModel):
    statement_ids: List[int]


class ToggleAdminRequest(BaseModel):
    is_admin: bool


class AdminUserUpdateRequest(CamelModel):
    personal_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    code: Optional[str] = None


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    unique_code: str | None = None
    level: str  # architect, expert
    status: str  # active, suspended, expired
    issue_date: datetime | None = None
    validity_term: int | None = None  # years
    valid_until: datetime | None = None
    exam_score: int | None = None
    filename: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    created_at: datetime
    updated_at: datetime


class CertificateCreate(BaseModel):
    unique_code: str | None = None
    level: str = "architect"  # architect, expert
    status: str = "active"  # active, suspended, expired
    issue_date: datetime | None = None
    validity_term: int | None = None  # years
    valid_until: datetime | None = None
    exam_score: int | None = None


class CertificateUpdate(CamelModel):
    unique_code: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    issue_date: Optional[datetime] = None
    validity_term: Optional[int] = None
    valid_until: Optional[datetime] = None
    exam_score: Optional[int] = None


class RegistryPersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    photo_url: str
    unique_code: str
    qualification: str
    certificate_status: str
    rating: float | None = None
    exam_score: int | None = None
    registration_date: datetime


# Reviews (ratings and comments)
class ReviewCriteria(BaseModel):
    integrity: float = Field(ge=0, le=5)
    responsibility: float = Field(ge=0, le=5)
    knowledge_experience: float = Field(ge=0, le=5)
    professional_skills: float = Field(ge=0, le=5)
    price_quality: float = Field(ge=0, le=5)


class ReviewRatingCreate(BaseModel):
    criteria: ReviewCriteria


class ReviewCommentCreate(BaseModel):
    message: str


class ReviewCommentOut(BaseModel):
    id: int
    target_user_id: int
    author_user_id: int
    author_first_name: str | None = None
    author_last_name: str | None = None
    message: str
    created_at: datetime


class ReviewsSummaryOut(BaseModel):
    target_user_id: int
    average: float
    ratings_count: int
    actor_score: float | None = None
    actor_criteria: ReviewCriteria | None = None
    comments: List[ReviewCommentOut] = Field(default_factory=list)


# Expert uploads
class ExpertUploadOut(BaseModel):
    id: int
    unique_code: str
    status: str
    building_function: str
    cadastral_code: str
    expertise_filename: str | None = None
    project_filename: str | None = None
    created_at: datetime
    submitted_at: datetime | None = None


class ExpertUploadCreate(BaseModel):
    building_function: str
    cadastral_code: str


class ExpertUploadUpdate(BaseModel):
    building_function: str | None = None
    cadastral_code: str | None = None