"""fenix_training data models."""

from pydantic import BaseModel
from typing import Optional


class AnswerRequest(BaseModel):
    answer: str


class ApproveRequest(BaseModel):
    edited_pairs: Optional[list[dict]] = None


class UpdateEntryRequest(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


class QuestionBankApproveRequest(BaseModel):
    question_text: str
    answer_text: str
    category: Optional[str] = "question_bank"


class ManualInputRequest(BaseModel):
    question: str
    answer: str
    category: Optional[str] = "manual"


class ProductionReadyRequest(BaseModel):
    question: str
    answer: str


# ── Helpers ───────────────────────────────────────────────────────────
