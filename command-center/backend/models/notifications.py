"""notifications data models."""

from pydantic import BaseModel
from typing import Optional


class CreateNotification(BaseModel):
    type: str
    title: str
    summary: str = ""
    source: str = "manual"
    action_url: Optional[str] = None
    priority: str = "normal"
    reference_id: Optional[str] = None
    metadata: Optional[dict] = None


class MarkAllReadRequest(BaseModel):
    type: Optional[str] = None


class DismissAllRequest(BaseModel):
    type: Optional[str] = None


# ── Read endpoints ──────────────────────────────────────────────
