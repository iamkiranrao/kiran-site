"""
Notifications Router — inbox endpoints for the Command Center dashboard.
Supports listing, filtering, marking read, and dismissing notifications.
"""

from fastapi import APIRouter, HTTPException, Query
from models.notifications import CreateNotification, MarkAllReadRequest, DismissAllRequest
from typing import Optional

from services.notification_service import (
    get_notifications,
    get_notification_counts,
    create_notification,
    mark_read,
    mark_all_read,
    dismiss_notification,
    dismiss_all,
    cleanup_old_notifications,
)

router = APIRouter()

# ── Request models ──────────────────────────────────────────────

# ── Read endpoints ──────────────────────────────────────────────

@router.get("/", response_model=dict)
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    include_dismissed: bool = Query(False),
):
    """Paginated notification inbox."""
    return get_notifications(
        limit=limit,
        offset=offset,
        type_filter=type,
        priority_filter=priority,
        unread_only=unread_only,
        include_dismissed=include_dismissed,
    )

@router.get("/counts", response_model=dict)
async def notification_counts():
    """Summary counts for nav badge and stats cards."""
    return get_notification_counts()

# ── Write endpoints ─────────────────────────────────────────────

@router.post("/", response_model=dict)
async def add_notification(body: CreateNotification):
    """Manually create a notification (for testing or manual alerts)."""
    try:
        return create_notification(
            type=body.type,
            title=body.title,
            summary=body.summary,
            source=body.source,
            action_url=body.action_url,
            priority=body.priority,
            reference_id=body.reference_id,
            metadata=body.metadata,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Update endpoints ────────────────────────────────────────────

@router.patch("/{notification_id}/read", response_model=dict)
async def read_notification(notification_id: str):
    """Mark a single notification as read."""
    return mark_read(notification_id)

@router.patch("/read-all", response_model=dict)
async def read_all_notifications(body: MarkAllReadRequest = MarkAllReadRequest()):
    """Mark all unread notifications as read."""
    return mark_all_read(type_filter=body.type)

@router.patch("/{notification_id}/dismiss", response_model=dict)
async def dismiss_single(notification_id: str):
    """Dismiss a single notification."""
    return dismiss_notification(notification_id)

@router.patch("/dismiss-all", response_model=dict)
async def dismiss_all_notifications(body: DismissAllRequest = DismissAllRequest()):
    """Dismiss all active notifications."""
    return dismiss_all(type_filter=body.type)

# ── Maintenance ─────────────────────────────────────────────────

@router.delete("/cleanup", response_model=dict)
async def cleanup(days: int = Query(90, ge=7, le=365)):
    """Remove dismissed notifications older than N days."""
    return cleanup_old_notifications(days=days)
