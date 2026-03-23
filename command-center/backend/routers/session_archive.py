"""
Session Archive Router — endpoints for browsing, viewing, and deleting
archived session transcripts.
"""

from fastapi import APIRouter, HTTPException, Query

from services.session_archive_service import (
    list_sessions,
    get_session,
    delete_session,
    get_archive_stats,
)

router = APIRouter()


@router.get("/stats", response_model=dict)
async def archive_stats():
    """Summary stats about the session archive."""
    return get_archive_stats()


@router.get("/sessions", response_model=dict)
async def archive_list(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List archived sessions with metadata, newest first."""
    return list_sessions(limit=limit, offset=offset)


@router.get("/sessions/{filename}", response_model=dict)
async def archive_detail(filename: str):
    """Get full content of a specific archived session."""
    session = get_session(filename)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {filename}")
    return session


@router.delete("/sessions/{filename}", response_model=dict)
async def archive_delete(filename: str):
    """Delete a session from archive and chat-drops."""
    result = delete_session(filename)
    if not result["deleted"]:
        raise HTTPException(status_code=404, detail=result.get("error", "Delete failed"))
    return result
