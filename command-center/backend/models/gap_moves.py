"""Gap Closure Moves — the 10 high-leverage strategic moves that batch-close gaps.

Each Move maps to many gap items and contains a step-by-step plan.
Completing steps progresses the move; completing a move batch-resolves
its linked gaps and can auto-create career vault initiatives.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


MOVE_TYPES = ("reframe", "certification", "build", "content", "disposition")
MOVE_STATUSES = ("not-started", "in-progress", "completed", "paused")
STEP_STATUSES = ("pending", "in-progress", "completed", "skipped")
RESOLUTION_TYPES = ("have-it", "reframed", "built-proof", "certified", "not-pursuing", "not-a-gap")


class MoveStepUpdate(BaseModel):
    """Update a single step within a move."""
    status: Optional[str] = Field(None, description="pending, in-progress, completed, skipped")
    notes: Optional[str] = None


class MoveUpdate(BaseModel):
    """Partial update to a move's metadata."""
    title: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    gap_ids: Optional[List[str]] = None


class MoveCreate(BaseModel):
    """Create a new move (used for custom moves beyond the seeded 10)."""
    id: str = Field(..., description="Kebab-case slug, e.g. 'vault-rewrite'")
    title: str
    move_type: str = Field(..., description="reframe, certification, build, content, disposition")
    estimated_time: str
    gap_ids: List[str] = Field(default_factory=list)
    resolution_type: str = Field("reframed", description="How linked gaps resolve on completion")
    steps: List[dict] = Field(default_factory=list)
