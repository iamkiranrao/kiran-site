"""kirans_journal data models."""

from pydantic import BaseModel
from typing import Optional, List


class JournalEntryCreate(BaseModel):
    title: str
    body: str                                   # The thinking — what was decided, why, what it means
    category: str = "general"                   # One of VALID_CATEGORIES
    tags: List[str] = []                        # Free-form tags for cross-referencing
    workstreams: List[str] = []                 # Which workstreams this affects (e.g., "persona-picker", "scannibal")
    source_session: Optional[str] = None        # Session archive filename if captured from a session
    decision: Optional[str] = None              # 1-2 sentence decision summary (for decision entries)
    alternatives_considered: Optional[str] = None  # What else was on the table
    open_questions: Optional[str] = None        # Unresolved tensions or follow-ups


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    workstreams: Optional[List[str]] = None
    decision: Optional[str] = None
    alternatives_considered: Optional[str] = None
    open_questions: Optional[str] = None
    status: Optional[str] = None                # active, resolved, superseded, revisit
    resolution: Optional[str] = None            # For apprehensions — how it was resolved


# ── Endpoints ────────────────────────────────────────────────────
