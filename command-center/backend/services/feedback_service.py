"""
Feedback & Testimonial Service — stores and retrieves site feedback
and testimonials via Supabase.

Tables used:
  - site_feedback: id, rating, comment, created_at, ip_address, user_agent
  - testimonials: id, name, role, testimonial, is_public, status, created_at
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ── Site Feedback ────────────────────────────────────────────────


def submit_feedback(rating: Optional[str], comment: Optional[str], ip: Optional[str] = None, user_agent: Optional[str] = None) -> dict:
    """Store a new feedback submission."""
    sb = _get_client()
    row = {
        "rating": rating,
        "comment": comment or "",
        "ip_address": ip,
        "user_agent": user_agent,
    }
    result = sb.table("site_feedback").insert(row).execute()
    feedback_id = result.data[0]["id"] if result.data else None

    # Emit notification
    try:
        from services.notification_service import notify_new_feedback
        if feedback_id:
            notify_new_feedback(feedback_id, rating, comment or "")
    except Exception as e:
        logger.warning("Failed to emit feedback notification: %s", e)

    return {"success": True, "id": feedback_id}


def get_feedback_stats(days: int = 30) -> dict:
    """Summary stats for the feedback dashboard."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    all_feedback = (
        sb.table("site_feedback")
        .select("id, rating, comment, created_at")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .execute()
    )

    total = len(all_feedback.data)
    rating_counts = {"love": 0, "like": 0, "neutral": 0, "dislike": 0}
    with_comments = 0

    for f in all_feedback.data:
        r = f.get("rating")
        if r in rating_counts:
            rating_counts[r] += 1
        if f.get("comment", "").strip():
            with_comments += 1

    # Daily counts for sparkline
    daily_counts = {}
    for f in all_feedback.data:
        day = f["created_at"][:10]
        daily_counts[day] = daily_counts.get(day, 0) + 1

    return {
        "total": total,
        "rating_breakdown": rating_counts,
        "with_comments": with_comments,
        "daily_counts": daily_counts,
        "period_days": days,
    }


def list_feedback(limit: int = 50, offset: int = 0, rating_filter: Optional[str] = None) -> dict:
    """Paginated list of feedback entries."""
    sb = _get_client()

    query = (
        sb.table("site_feedback")
        .select("id, rating, comment, created_at, ip_address, user_agent", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if rating_filter:
        query = query.eq("rating", rating_filter)

    result = query.execute()

    return {
        "feedback": result.data,
        "total": result.count or 0,
        "offset": offset,
        "limit": limit,
    }


def delete_feedback(feedback_id: str) -> dict:
    """Delete a single feedback entry."""
    sb = _get_client()
    sb.table("site_feedback").delete().eq("id", feedback_id).execute()
    return {"success": True}


# ── Testimonials ─────────────────────────────────────────────────


def submit_testimonial(name: str, role: Optional[str], testimonial: str, is_public: bool = False) -> dict:
    """Store a new testimonial submission."""
    sb = _get_client()
    row = {
        "name": name,
        "role": role or "",
        "testimonial": testimonial,
        "is_public": is_public,
        "status": "pending",  # pending → approved / rejected
    }
    result = sb.table("testimonials").insert(row).execute()
    testimonial_id = result.data[0]["id"] if result.data else None

    # Emit notification
    try:
        from services.notification_service import notify_new_testimonial
        if testimonial_id:
            notify_new_testimonial(testimonial_id, name, testimonial[:200])
    except Exception as e:
        logger.warning("Failed to emit testimonial notification: %s", e)

    return {"success": True, "id": testimonial_id}


def get_testimonial_stats() -> dict:
    """Summary stats for testimonials."""
    sb = _get_client()

    all_testimonials = (
        sb.table("testimonials")
        .select("id, status, is_public, created_at")
        .execute()
    )

    total = len(all_testimonials.data)
    status_counts = {"pending": 0, "approved": 0, "rejected": 0}
    public_count = 0

    for t in all_testimonials.data:
        s = t.get("status", "pending")
        status_counts[s] = status_counts.get(s, 0) + 1
        if t.get("is_public"):
            public_count += 1

    return {
        "total": total,
        "status_breakdown": status_counts,
        "public_count": public_count,
    }


def list_testimonials(limit: int = 50, offset: int = 0, status_filter: Optional[str] = None) -> dict:
    """Paginated list of testimonials."""
    sb = _get_client()

    query = (
        sb.table("testimonials")
        .select("id, name, role, testimonial, is_public, status, created_at", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()

    return {
        "testimonials": result.data,
        "total": result.count or 0,
        "offset": offset,
        "limit": limit,
    }


def update_testimonial_status(testimonial_id: str, status: str) -> dict:
    """Approve or reject a testimonial."""
    if status not in ("approved", "rejected", "pending"):
        raise ValueError(f"Invalid status: {status}")

    sb = _get_client()
    sb.table("testimonials").update({"status": status}).eq("id", testimonial_id).execute()
    return {"success": True}


def list_public_testimonials(limit: int = 50) -> dict:
    """Return approved public testimonials for the website display wall."""
    sb = _get_client()
    result = (
        sb.table("testimonials")
        .select("name, role, testimonial, created_at")
        .eq("status", "approved")
        .eq("is_public", True)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"testimonials": result.data}


def delete_testimonial(testimonial_id: str) -> dict:
    """Delete a testimonial."""
    sb = _get_client()
    sb.table("testimonials").delete().eq("id", testimonial_id).execute()
    return {"success": True}
