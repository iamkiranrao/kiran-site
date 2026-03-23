"""wordweaver data models."""

from pydantic import BaseModel
from typing import Optional


class CreateRequest(BaseModel):
    mode: str  # "blog" or "social"
    theme: Optional[str] = None
    angle: Optional[str] = None
    series: Optional[str] = None


class StepRequest(BaseModel):
    user_input: Optional[str] = None


class ApproveRequest(BaseModel):
    decision: Optional[str] = "Approved"


class ReviseRequest(BaseModel):
    feedback: str


class GoToStepRequest(BaseModel):
    step: int


class EditFinalRequest(BaseModel):
    feedback: str


class ThemeRequest(BaseModel):
    name: str
    description: str


class PreviewRequest(BaseModel):
    html_content: str
    slug: str
    card_html: Optional[str] = None


class PublishRequest(BaseModel):
    session_id: str
    html_content: str
    slug: str
    card_html: Optional[str] = None


class CrossPostRequest(BaseModel):
    """Request to generate Medium/Substack-ready Markdown from a published post."""
    session_id: str


# ── Endpoints ──────────────────────────────────────────────────────
