"""Studio pieces data models.

Holds the editable per-piece notes for the Studio Illustration page.
Keys mirror the data-key attribute on each card in studio-illustration.html
so the public read endpoint can resolve a piece by its on-page identifier.
"""

from pydantic import BaseModel
from typing import Optional


class StudioPieceUpdate(BaseModel):
    """Body for PUT /api/studio-pieces/{key}. Note is the only editable field."""
    note: Optional[str] = None


class StudioPieceOut(BaseModel):
    """Response shape for both single-piece reads and list reads."""
    key: str
    note: str
    updated_at: Optional[str] = None
