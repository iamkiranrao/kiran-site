"""ideas data models."""

from pydantic import BaseModel
from typing import Optional, List


class IdeaCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "general"           # e.g. "job-radar", "resume", "fenix", "infra", "general"
    priority: str = "medium"            # low, medium, high
    estimated_effort: str = ""          # e.g. "small", "medium", "large", "XL"
    tags: List[str] = []


class IdeaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None        # backlog, in-progress, done, parked
    estimated_effort: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────
