from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


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


class AuthCodeRequest(BaseModel):
    exam_id: int
    code: str


class AuthCodeResponse(BaseModel):
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


class AdminStatsResponse(BaseModel):
    total_blocks: int
    total_questions: int
    enabled_blocks: int
    enabled_questions: int


