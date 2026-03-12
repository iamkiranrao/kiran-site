"""
Fenix Journal Router — endpoints for browsing diary entries
and raw observations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.fenix_journal_service import (
    get_journal_stats,
    list_entries,
    get_entry,
    get_raw_observations,
    search_journal,
)

router = APIRouter()


@router.get("/stats")
async def journal_stats():
    """Summary stats about the journal."""
    return get_journal_stats()


@router.get("/entries")
async def journal_entries(
    stream: str = Query("all"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List entry dates with previews, newest first."""
    return list_entries(stream=stream, limit=limit, offset=offset)


@router.get("/entries/{date}")
async def journal_entry(date: str):
    """Get full content for a specific date (both streams)."""
    entry = get_entry(date)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No journal entry found for {date}")
    return entry


@router.get("/raw")
async def journal_raw():
    """Get raw observation files."""
    return get_raw_observations()


@router.get("/search")
async def journal_search(
    q: str = Query("", min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Full-text search across journal entries and session archive."""
    return search_journal(query=q, limit=limit)
