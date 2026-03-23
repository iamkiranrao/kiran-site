"""content_audit data models."""

from pydantic import BaseModel


class AuditRequest(BaseModel):
    file_path: str


# ── Endpoints ──────────────────────────────────────────────────────
