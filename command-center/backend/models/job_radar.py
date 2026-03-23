"""job_radar data models."""

from pydantic import BaseModel
from typing import Optional


class JobStatusUpdate(BaseModel):
    status: str  # new, reviewing, applied, dismissed, saved
    notes: Optional[str] = None


class PipelinePush(BaseModel):
    persona: Optional[str] = "pm"        # pm, pjm, pmm
    length: Optional[str] = "2pager"     # 1pager, 2pager, detailed
    tier: Optional[str] = "high-prob"    # dream, high-prob, practice


# ── Endpoints ──────────────────────────────────────────────────────
