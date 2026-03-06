"""
Feedback & Testimonial Router — public submission endpoints (called from the
landing page) and authenticated dashboard endpoints (for Command Center).
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional

from services.feedback_service import (
    submit_feedback,
    get_feedback_stats,
    list_feedback,
    delete_feedback,
    submit_testimonial,
    get_testimonial_stats,
    list_testimonials,
    update_testimonial_status,
    delete_testimonial,
)

router = APIRouter()


# ── Request models ──────────────────────────────────────────────


class FeedbackSubmission(BaseModel):
    rating: Optional[str] = None
    comment: Optional[str] = None


class TestimonialSubmission(BaseModel):
    name: str
    role: Optional[str] = None
    testimonial: str
    is_public: bool = False


class StatusUpdate(BaseModel):
    status: str  # "approved" | "rejected" | "pending"


# ── Public endpoints (called from landing page) ─────────────────


@router.post("/submit")
async def public_submit_feedback(body: FeedbackSubmission, request: Request):
    """Accept feedback from the public landing page."""
    if not body.rating and not (body.comment or "").strip():
        raise HTTPException(status_code=400, detail="Rating or comment required")

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    return submit_feedback(
        rating=body.rating,
        comment=body.comment,
        ip=ip,
        user_agent=ua,
    )


@router.post("/testimonial/submit")
async def public_submit_testimonial(body: TestimonialSubmission):
    """Accept testimonial from the public landing page."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not body.testimonial.strip():
        raise HTTPException(status_code=400, detail="Testimonial text is required")

    return submit_testimonial(
        name=body.name,
        role=body.role,
        testimonial=body.testimonial,
        is_public=body.is_public,
    )


# ── Dashboard endpoints ─────────────────────────────────────────


@router.get("/stats")
async def feedback_stats(days: int = Query(30, ge=1, le=365)):
    """Feedback summary stats for the dashboard."""
    return get_feedback_stats(days=days)


@router.get("/list")
async def feedback_list(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    rating: Optional[str] = Query(None),
):
    """Paginated feedback entries."""
    return list_feedback(limit=limit, offset=offset, rating_filter=rating)


@router.delete("/{feedback_id}")
async def feedback_delete(feedback_id: str):
    """Delete a feedback entry."""
    return delete_feedback(feedback_id)


@router.get("/testimonials/stats")
async def testimonial_stats():
    """Testimonial summary stats."""
    return get_testimonial_stats()


@router.get("/testimonials/list")
async def testimonial_list(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
):
    """Paginated testimonials."""
    return list_testimonials(limit=limit, offset=offset, status_filter=status)


@router.patch("/testimonials/{testimonial_id}/status")
async def testimonial_update_status(testimonial_id: str, body: StatusUpdate):
    """Approve or reject a testimonial."""
    try:
        return update_testimonial_status(testimonial_id, body.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/testimonials/{testimonial_id}")
async def testimonial_delete(testimonial_id: str):
    """Delete a testimonial."""
    return delete_testimonial(testimonial_id)
