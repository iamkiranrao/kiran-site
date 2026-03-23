"""Shared response models used across all modules.

These are the standard envelopes per BACKEND-STANDARDS.md Section 5 & 7.
Every list endpoint returns PaginatedResponse. Every error follows RFC 7807.
"""

from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard envelope for paginated list endpoints."""
    entries: List[T]
    total: int
    offset: int
    limit: int


class SuccessResponse(BaseModel):
    """Standard envelope for mutation confirmations."""
    success: bool = True
    id: Optional[str] = None
    message: Optional[str] = None


class ErrorDetail(BaseModel):
    """RFC 7807 problem detail (simplified)."""
    type: str = "about:blank"
    title: str
    status: int
    detail: Optional[str] = None
    instance: Optional[str] = None
