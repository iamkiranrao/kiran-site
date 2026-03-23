"""feedback data models."""

from pydantic import BaseModel
from typing import Optional


class FeedbackSubmission(BaseModel):
    rating: Optional[str] = None
    comment: Optional[str] = None


class TestimonialSubmission(BaseModel):
    name: str
    role: Optional[str] = None
    testimonial: str
    is_public: bool = False


class StatusUpdate(BaseModel):
    status: str  # "approved" | "rejected" | "pending"


# ── Public endpoints (called from landing page) ─────────────────
