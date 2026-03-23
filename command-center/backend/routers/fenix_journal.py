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
    get_connecting_thread,
    delete_entry,
    get_raw_observations,
    search_journal,
)

router = APIRouter()


@router.get("/stats", response_model=dict)
async def journal_stats():
    """Summary stats about the journal."""
    return get_journal_stats()


@router.get("/entries", response_model=dict)
async def journal_entries(
    stream: str = Query("all"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List entry dates with previews, newest first."""
    return list_entries(stream=stream, limit=limit, offset=offset)


@router.get("/connecting-threads/{slug}", response_model=dict)
async def connecting_thread(slug: str):
    """Get full content for a connecting-threads entry by slug."""
    thread = get_connecting_thread(slug)
    if not thread:
        raise HTTPException(status_code=404, detail=f"No connecting thread found: {slug}")
    return thread


@router.delete("/entries/{stream}/{identifier}", response_model=dict)
async def remove_entry(stream: str, identifier: str):
    """Delete a journal entry. stream is 'about-kiran', 'build-journey', or 'connecting-threads'."""
    if stream not in ("about-kiran", "build-journey", "connecting-threads"):
        raise HTTPException(status_code=400, detail=f"Invalid stream: {stream}")
    deleted = delete_entry(stream, identifier)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Entry not found: {stream}/{identifier}")
    return {"deleted": True, "stream": stream, "identifier": identifier}


@router.get("/entries/{date}", response_model=dict)
async def journal_entry(date: str):
    """Get full content for a specific date (both streams)."""
    entry = get_entry(date)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No journal entry found for {date}")
    return entry


@router.get("/raw", response_model=dict)
async def journal_raw():
    """Get raw observation files."""
    return get_raw_observations()


@router.get("/search", response_model=dict)
async def journal_search(
    q: str = Query("", min_length=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Full-text search across journal entries and session archive."""
    return search_journal(query=q, limit=limit)
