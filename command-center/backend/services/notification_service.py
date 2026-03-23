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
    "action_item",
    "journal_entry",
    "docs_drift",
    "system",
    # Added in System Wiring Task 2
    "standards_violation",
    "job_match",
    "interview_reminder",
    "health_alert",
    "cost_alert",
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


def notify_new_action_item(item_id: str, title: str, priority: str, workstream: str) -> dict:
    """Called when a new action item is created."""
    notif_priority = "high" if priority in ("critical", "high") else "normal"
    return create_notification(
        type="action_item",
        title=f"New action item: {title}",
        summary=f"Priority: {priority} · Workstream: {workstream}",
        source="action_items",
        action_url="/dashboard/action-items",
        priority=notif_priority,
        reference_id=item_id,
    )


def notify_new_journal_entry(entry_id: str, title: str, category: str) -> dict:
    """Called when a new Kiran's Journal entry is created."""
    return create_notification(
        type="journal_entry",
        title=f"Journal: {title}",
        summary=f"Category: {category}",
        source="kirans_journal",
        action_url="/dashboard/kirans-journal",
        priority="low",
        reference_id=entry_id,
    )


def notify_docs_drift(drift_items: list[dict]) -> dict:
    """Called by session-capture when docs may have drifted from code."""
    count = len(drift_items)
    titles = [d.get("doc", "unknown") for d in drift_items[:5]]
    summary = f"Docs that may need updating: {', '.join(titles)}"
    if count > 5:
        summary += f" and {count - 5} more"

    return create_notification(
        type="docs_drift",
        title=f"{count} doc{'s' if count != 1 else ''} may be out of date",
        summary=summary,
        source="session_capture",
        action_url="/dashboard/action-items",
        priority="normal",
        metadata={"drift_items": drift_items},
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


# ── System Wiring: New notification helpers ──────────────────────


def notify_standards_violation(
    pillar: str, new_violations: int, critical_count: int, score: float
) -> dict:
    """Called after run_pillar_audit() when new (non-baselined) violations are found.

    Only fires when critical_count > 0 to avoid notification spam.
    """
    if critical_count == 0 and new_violations == 0:
        return {"success": True, "skipped": True, "reason": "no critical violations"}

    priority = "urgent" if critical_count > 0 else "high"
    title = f"Standards: {pillar} audit found {new_violations} new violation{'s' if new_violations != 1 else ''}"
    summary = f"Score: {score}/100. {critical_count} critical, {new_violations} new."

    return create_notification(
        type="standards_violation",
        title=title,
        summary=summary,
        source="standards_service",
        action_url="/dashboard/standards",
        priority=priority,
        reference_id=f"audit-{pillar}",
        metadata={
            "pillar": pillar,
            "new_violations": new_violations,
            "critical_count": critical_count,
            "score": score,
        },
    )


def notify_job_match(new_job_count: int, top_match: Optional[dict] = None) -> dict:
    """Called after run_full_scan() when new matching jobs are discovered.

    Only fires when at least 1 new job is found.
    """
    if new_job_count == 0:
        return {"success": True, "skipped": True, "reason": "no new jobs"}

    gold_count = 0
    top_title = ""
    top_company = ""
    if top_match:
        top_title = top_match.get("title", "Unknown")
        top_company = top_match.get("company", "Unknown")
        if top_match.get("freshness") == "gold":
            gold_count = 1

    priority = "high" if gold_count > 0 else "normal"
    title = f"Job Radar: {new_job_count} new match{'es' if new_job_count != 1 else ''}"
    summary = f"Top match: {top_title} at {top_company}" if top_match else f"{new_job_count} new jobs found"

    return create_notification(
        type="job_match",
        title=title,
        summary=summary,
        source="job_radar",
        action_url="/dashboard/job-radar",
        priority=priority,
        metadata={
            "new_job_count": new_job_count,
            "top_title": top_title,
            "top_company": top_company,
            "has_gold": gold_count > 0,
        },
    )


def notify_interview_reminder(
    app_id: str, company: str, role: str, interview_type: str
) -> dict:
    """Called when an interview is logged, so Kiran can prep."""
    return create_notification(
        type="interview_reminder",
        title=f"Interview logged: {company}",
        summary=f"{interview_type.title()} interview for {role} at {company}.",
        source="job_central",
        action_url="/dashboard/job-central",
        priority="high",
        reference_id=app_id,
        metadata={
            "company": company,
            "role": role,
            "interview_type": interview_type,
        },
    )


def notify_fenix_dead_end(failure_count: int, top_query: str = "") -> dict:
    """Called when Fenix failure count exceeds threshold.

    Only fires when failure_count >= 5 to avoid noise from occasional misses.
    """
    if failure_count < 5:
        return {"success": True, "skipped": True, "reason": "below threshold"}

    title = f"Fenix: {failure_count} conversation failures"
    summary = f"Top failing query: \"{top_query[:80]}\"" if top_query else f"{failure_count} queries with no RAG results"

    return create_notification(
        type="fenix_dead_end",
        title=title,
        summary=summary,
        source="fenix_dashboard",
        action_url="/dashboard/fenix",
        priority="high" if failure_count >= 10 else "normal",
        metadata={"failure_count": failure_count, "top_query": top_query},
    )


def notify_health_alert(service_name: str, status: str, detail: str = "") -> dict:
    """Called when a health check dependency fails."""
    return create_notification(
        type="health_alert",
        title=f"Health: {service_name} is {status}",
        summary=detail or f"{service_name} dependency check failed.",
        source="health_check",
        action_url="/dashboard/health",
        priority="urgent" if status == "down" else "high",
        reference_id=f"health-{service_name}",
        metadata={"service": service_name, "status": status},
    )


def notify_cost_alert(
    current_spend: float, budget: float, budget_pct: float, period: str
) -> dict:
    """Called when monthly spend exceeds 80% of budget.

    Only fires at 80% and 100% thresholds.
    """
    if budget_pct < 80:
        return {"success": True, "skipped": True, "reason": "below threshold"}

    if budget_pct >= 100:
        priority = "urgent"
        title = f"Tech Costs: budget exceeded ({budget_pct:.0f}%)"
    else:
        priority = "high"
        title = f"Tech Costs: {budget_pct:.0f}% of budget used"

    summary = f"${current_spend:.2f} of ${budget:.2f} budget for {period}."

    return create_notification(
        type="cost_alert",
        title=title,
        summary=summary,
        source="tech_costs",
        action_url="/dashboard/tech-costs",
        priority=priority,
        reference_id=f"cost-{period}",
        metadata={
            "current_spend": current_spend,
            "budget": budget,
            "budget_pct": budget_pct,
            "period": period,
        },
    )


def notify_draft_content(
    content_type: str, title: str, slug: str, session_id: str
) -> dict:
    """Called when creative content (blog, teardown, prototype) is deployed to production."""
    action_urls = {
        "blog": "/dashboard/wordweaver",
        "teardown": "/dashboard/teardowns",
        "prototype": "/dashboard/madlab",
    }
    return create_notification(
        type="draft_content",
        title=f"{content_type.title()} deployed: {title}",
        summary=f"\"{title}\" is now live on the site.",
        source=f"{content_type}_deploy",
        action_url=action_urls.get(content_type, "/dashboard"),
        priority="normal",
        reference_id=session_id,
        metadata={"content_type": content_type, "slug": slug},
    )
