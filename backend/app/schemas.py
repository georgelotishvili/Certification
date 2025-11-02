from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict
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


class ResultListResponse(BaseModel):
    items: List[ResultListItem]
    total: int


class AnswerDetail(BaseModel):
    question_id: int
    question_code: str
    question_text: str
    option_id: int
    option_text: str
    is_correct: bool
    answered_at: datetime


class ResultDetailResponse(BaseModel):
    session: ResultListItem
    block_stats: List[dict]
    answers: List[AnswerDetail]


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


class ToggleAdminRequest(BaseModel):
    is_admin: bool

