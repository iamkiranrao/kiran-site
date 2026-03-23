"""visual_audit data models."""

from pydantic import BaseModel


class VisualAuditRequest(BaseModel):
    file_path: str
