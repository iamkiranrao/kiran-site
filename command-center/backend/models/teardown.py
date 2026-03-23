"""teardown data models."""

from pydantic import BaseModel
from typing import Optional


class CreateRequest(BaseModel):
    company: str
    product: str


class StepRequest(BaseModel):
    user_input: Optional[str] = None


class ApproveRequest(BaseModel):
    decision: Optional[str] = "Approved"


class ReviseRequest(BaseModel):
    feedback: str


class GoToStepRequest(BaseModel):
    step: int


class PublishRequest(BaseModel):
    html_content: str
    company_card_html: Optional[str] = None
    tier2_html: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────
