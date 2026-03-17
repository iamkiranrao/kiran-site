"""
Notification Service — unified inbox for Command Center.

Any service or pipeline can write notifications. The frontend reads and
dismisses them. This is the "operating system" layer that surfaces
actionable items in one place.

Tables used:
  - notifications: id, type, source, title, summary, action_url,
                   priority, read, dismissed, reference_id, metadata,
                   created_at, read_at, dismissed_at
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from supabase import Client, create_client

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ── Valid types (must match migration CHECK constraint) ──────────

VALID_TYPES = {
    "feedback",
    "testimonial",
    "fenix_widget",
    "fenix_dead_end",
    "task_failure",
    "embedding_status",
    "content_freshness",
    "journal_pending",
    "training_progress",
    "draft_content",
    "system",
}

VALID_PRIORITIES = {"low", "normal", "high", "urgent"}


# ── Write ────────────────────────────────────────────────────────


def create_notification(
    type: str,
    title: str,
    summary: str = "",
    source: str = "system",
    action_url: Optional[str] = None,
    priority: str = "normal",
    reference_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    deduplicate: bool = True,
) -> dict:
    """
    Create a new notification. Any service can call this.

    If deduplicate=True (default), checks for an existing unread
    notification with the same type + reference_id and skips if found.
    """
    if type not in VALID_TYPES:
        raise ValueError(f"Invalid notification type: {type}. Must be one of {VALID_TYPES}")
    if priority not in VALID_PRIORITIES:
        raise ValueError(f"Invalid priority: {priority}. Must be one of {VALID_PRIORITIES}")

    sb = _get_client()

    # Deduplicate: skip if there's already an unread notification for this ref
    if deduplicate and reference_id:
        existing = (
            sb.table("notifications")
            .select("id")
            .eq("type", type)
            .eq("reference_id", reference_id)
            .eq("dismissed", False)
            .limit(1)
            .execute()
        )
        if existing.data:
            logger.debug(
                "Skipping duplicate notification: type=%s ref=%s",
                type,
                reference_id,
            )
            return {"success": True, "id": existing.data[0]["id"], "deduplicated": True}

    row = {
        "type": type,
        "source": source,
        "title": title,
        "summary": summary,
        "action_url": action_url,
        "priority": priority,
        "reference_id": reference_id,
        "metadata": metadata or {},
    }

    result = sb.table("notifications").insert(row).execute()
    notif_id = result.data[0]["id"] if result.data else None

    logger.info(
        "Created notification: type=%s title='%s' priority=%s id=%s",
        type,
        title[:60],
        priority,
        notif_id,
    )
    return {"success": True, "id": notif_id}


# ── Read ─────────────────────────────────────────────────────────


def get_notifications(
    limit: int = 50,
    offset: int = 0,
    type_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    unread_only: bool = False,
    include_dismissed: bool = False,
) -> dict:
    """Paginated notification list for the inbox."""
    sb = _get_client()

    query = (
        sb.table("notifications")
        .select("*", count="exact")
        .order("created_at", desc=True)
    )

    if not include_dismissed:
        query = query.eq("dismissed", False)

    if unread_only:
        query = query.eq("read", False)

    if type_filter:
        query = query.eq("type", type_filter)

    if priority_filter:
        query = query.eq("priority", priority_filter)

    query = query.range(offset, offset + limit - 1)

    result = query.execute()

    return {
        "notifications": result.data,
        "total": result.count or 0,
        "offset": offset,
        "limit": limit,
    }


def get_notification_counts() -> dict:
    """
    Summary counts for the nav badge and dashboard stats.
    Returns unread count, counts by type, and counts by priority.
    """
    sb = _get_client()

    # All non-dismissed notifications
    active = (
        sb.table("notifications")
        .select("id, type, priority, read")
        .eq("dismissed", False)
        .execute()
    )

    total_active = len(active.data)
    unread = 0
    by_type: dict[str, int] = {}
    by_priority: dict[str, int] = {}

    for n in active.data:
        if not n.get("read"):
            unread += 1

        t = n.get("type", "system")
        by_type[t] = by_type.get(t, 0) + 1

        p = n.get("priority", "normal")
        by_priority[p] = by_priority.get(p, 0) + 1

    return {
        "total_active": total_active,
        "unread": unread,
        "by_type": by_type,
        "by_priority": by_priority,
    }


# ── Update ───────────────────────────────────────────────────────


def mark_read(notification_id: str) -> dict:
    """Mark a single notification as read."""
    sb = _get_client()
    sb.table("notifications").update({
        "read": True,
        "read_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", notification_id).execute()
    return {"success": True}


def mark_all_read(type_filter: Optional[str] = None) -> dict:
    """Mark all unread notifications as read (optionally filtered by type)."""
    sb = _get_client()
    query = (
        sb.table("notifications")
        .update({
            "read": True,
            "read_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("read", False)
        .eq("dismissed", False)
    )

    if type_filter:
        query = query.eq("type", type_filter)

    query.execute()
    return {"success": True}


def dismiss_notification(notification_id: str) -> dict:
    """Dismiss (soft-delete) a notification."""
    sb = _get_client()
    sb.table("notifications").update({
        "dismissed": True,
        "dismissed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", notification_id).execute()
    return {"success": True}


def dismiss_all(type_filter: Optional[str] = None) -> dict:
    """Dismiss all active notifications (optionally filtered by type)."""
    sb = _get_client()
    query = (
        sb.table("notifications")
        .update({
            "dismissed": True,
            "dismissed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("dismissed", False)
    )

    if type_filter:
        query = query.eq("type", type_filter)

    query.execute()
    return {"success": True}


# ── Cleanup ──────────────────────────────────────────────────────


def cleanup_old_notifications(days: int = 90) -> dict:
    """Remove dismissed notifications older than N days."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        sb.table("notifications")
        .delete()
        .eq("dismissed", True)
        .lt("created_at", cutoff)
        .execute()
    )

    deleted = len(result.data) if result.data else 0
    logger.info("Cleaned up %d old notifications (older than %d days)", deleted, days)
    return {"success": True, "deleted": deleted}


# ── Convenience helpers for common notification patterns ─────────


def notify_new_feedback(feedback_id: str, rating: Optional[str], comment: str) -> dict:
    """Called by feedback_service when new feedback arrives."""
    title = f"New feedback: {rating or 'no rating'}"
    summary = (comment[:200] + "...") if len(comment) > 200 else comment
    if not summary.strip():
        summary = f"Visitor submitted {rating} feedback"

    return create_notification(
        type="feedback",
        title=title,
        summary=summary,
        source="feedback_service",
        action_url="/dashboard/feedback",
        priority="normal",
        reference_id=feedback_id,
    )


def notify_new_testimonial(testimonial_id: str, name: str, snippet: str) -> dict:
    """Called by feedback_service when a new testimonial is submitted."""
    return create_notification(
        type="testimonial",
        title=f"New testimonial from {name}",
        summary=(snippet[:200] + "...") if len(snippet) > 200 else snippet,
        source="feedback_service",
        action_url="/dashboard/feedback",
        priority="normal",
        reference_id=testimonial_id,
    )


def notify_task_failure(task_name: str, error_message: str, task_id: Optional[str] = None) -> dict:
    """Called when a scheduled task fails."""
    return create_notification(
        type="task_failure",
        title=f"Task failed: {task_name}",
        summary=error_message[:300],
        source="scheduler",
        priority="high",
        reference_id=task_id,
        metadata={"task_name": task_name, "error": error_message},
    )


def notify_journal_pending(entry_count: int) -> dict:
    """Called by journal pipeline when new entries are ready for review."""
    return create_notification(
        type="journal_pending",
        title=f"{entry_count} journal {'entry' if entry_count == 1 else 'entries'} pending review",
        summary="New session transcripts have been processed into journal entries.",
        source="journal_pipeline",
        action_url="/dashboard/fenix-journal",
        priority="normal",
    )


def notify_embedding_status(
    pages_updated: int, errors: int, source_name: str = "reindex"
) -> dict:
    """Called after an embedding/reindex run."""
    if errors > 0:
        return create_notification(
            type="embedding_status",
            title=f"Embedding run completed with {errors} errors",
            summary=f"{pages_updated} pages updated, {errors} failed.",
            source=source_name,
            priority="high",
            metadata={"pages_updated": pages_updated, "errors": errors},
        )
    elif pages_updated > 0:
        return create_notification(
            type="embedding_status",
            title=f"Embeddings updated: {pages_updated} pages",
            summary=f"Reindex completed successfully. {pages_updated} pages refreshed.",
            source=source_name,
            priority="low",
        )
    # No changes, no notification needed
    return {"success": True, "skipped": True}


def notify_content_freshness(stale_pages: list[dict]) -> dict:
    """Called by a scheduled check when content is stale."""
    count = len(stale_pages)
    titles = [p.get("title", "Untitled") for p in stale_pages[:5]]
    summary = f"Pages needing update: {', '.join(titles)}"
    if count > 5:
        summary += f" and {count - 5} more"

    return create_notification(
        type="content_freshness",
        title=f"{count} pages may be stale",
        summary=summary,
        source="content_audit",
        action_url="/dashboard/content-audit",
        priority="normal" if count < 5 else "high",
        metadata={"stale_pages": stale_pages},
    )


def notify_training_progress(answered: int, total: int, gaps: list[str] = None) -> dict:
    """Called to report training question bank progress."""
    pct = round((answered / total) * 100) if total > 0 else 0
    summary = f"{answered}/{total} questions answered ({pct}%)"
    if gaps:
        summary += f". Gaps in: {', '.join(gaps[:5])}"

    return create_notification(
        type="training_progress",
        title=f"Training progress: {pct}% complete",
        summary=summary,
        source="fenix_training",
        action_url="/dashboard/fenix/training",
        priority="low",
        metadata={"answered": answered, "total": total, "pct": pct, "gaps": gaps or []},
    )
