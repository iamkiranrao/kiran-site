"""madlab data models."""

from pydantic import BaseModel
from typing import Optional, List


class CreateRequest(BaseModel):
    project_name: str
    project_slug: str
    category: str


class ContentUpdate(BaseModel):
    tagline: Optional[str] = None
    meta_description: Optional[str] = None
    tags: Optional[List[str]] = None
    launch_url: Optional[str] = None
    project_status: Optional[str] = None
    glossary: Optional[list] = None
    details_html: Optional[str] = None
    architecture_html: Optional[str] = None
    try_it_html: Optional[str] = None
    related_html: Optional[str] = None


class DraftRequest(BaseModel):
    extra_context: Optional[str] = ""


# ── Endpoints ─────────────────────────────────────────────────────
