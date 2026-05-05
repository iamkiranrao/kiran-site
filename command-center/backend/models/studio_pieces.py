"""Studio pieces data models.

Holds the editable per-piece text attributes for the Studio Illustration page.
Keys mirror the data-key attribute on each card in studio-illustration.html
so the public read endpoint can resolve a piece by its on-page identifier.

All fields are CC-editable overrides of the inline values in pieceData inside
studio-illustration.html. The page treats CC as authoritative when a field has
a non-empty value, and falls back to the inline HTML value otherwise.

Field naming matches the page-side pieceData object (camelCase) so the wire
format matches without a translation layer.
"""

from pydantic import BaseModel
from typing import Optional


class StudioPieceUpdate(BaseModel):
    """Body for PUT /api/studio-pieces/{key}.

    Every field is optional. The handler merges sent fields onto the existing
    record — fields you don't send are preserved. Send an empty string to
    explicitly clear a field (which makes the page fall back to the inline
    HTML value)."""
    title: Optional[str] = None
    date: Optional[str] = None
    tools: Optional[str] = None
    style: Optional[str] = None
    inspiredBy: Optional[str] = None
    dimensions: Optional[str] = None
    note: Optional[str] = None


class StudioPieceOut(BaseModel):
    """Response shape for GET endpoints. All editable fields default to empty
    strings so the page can do a simple `if (cc.field)` check."""
    key: str
    title: str = ""
    date: str = ""
    tools: str = ""
    style: str = ""
    inspiredBy: str = ""
    dimensions: str = ""
    note: str = ""
    updated_at: Optional[str] = None
