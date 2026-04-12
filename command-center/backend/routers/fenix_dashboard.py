"""
Fenix Dashboard Router — analytics and insights for Fenix AI assistant.

Endpoints:
  GET  /overview               — summary stats (conversations, messages, depth)
  GET  /queries                — top queries by frequency
  GET  /failures               — queries with 0 citations or keyword fallback
  GET  /coverage               — content page citation frequency
  GET  /conversations          — browse conversation list
  GET  /conversations/{id}     — full conversation transcript
  GET  /search-quality         — similarity scores, search type distribution
  GET  /outcomes               — site-level outcomes (connections, testimonials, fit scores)
  GET  /training               — training data stats
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.fenix_dashboard_service import (
    get_overview,
    get_top_queries,
    get_failures,
    get_content_coverage,
    list_conversations,
    get_conversation_detail,
    get_search_quality,
    get_training_stats,
    get_outcomes,
)

router = APIRouter()


@router.get("/overview", response_model=dict)
async def overview(days: int = Query(30, ge=1, le=365)):
    """Summary stats: total conversations, messages, avg depth, unique visitors."""
    try:
        return get_overview(days=days)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch overview: {e}")


@router.get("/queries", response_model=dict)
async def top_queries(
    limit: int = Query(20, ge=1, le=100),
    days: int = Query(30, ge=1, le=365),
):
    """Top user queries by frequency."""
    try:
        return {"queries": get_top_queries(limit=limit, days=days)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch queries: {e}")


@router.get("/failures", response_model=dict)
async def failures(
    limit: int = Query(50, ge=1, le=200),
    days: int = Query(30, ge=1, le=365),
):
    """Queries with no RAG results, low similarity, or keyword fallback."""
    try:
        return {"failures": get_failures(limit=limit, days=days)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch failures: {e}")


@router.get("/coverage", response_model=dict)
async def content_coverage(days: int = Query(30, ge=1, le=365)):
    """Which content pages get cited most/least."""
    try:
        return get_content_coverage(days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch coverage: {e}")


@router.get("/conversations", response_model=dict)
async def conversations(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
):
    """Browse conversation list with previews."""
    try:
        return list_conversations(limit=limit, offset=offset, search=search)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch conversations: {e}"
        )


@router.get("/conversations/{conversation_id}", response_model=dict)
async def conversation_detail(conversation_id: str):
    """Full conversation transcript with metadata."""
    try:
        result = get_conversation_detail(conversation_id)
        if not result.get("conversation"):
            raise HTTPException(status_code=404, detail="Conversation not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch conversation: {e}"
        )


@router.get("/search-quality", response_model=dict)
async def search_quality(days: int = Query(30, ge=1, le=365)):
    """Search type distribution and similarity score trends."""
    try:
        return get_search_quality(days=days)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch search quality: {e}"
        )


@router.get("/outcomes", response_model=dict)
async def outcomes(days: int = Query(30, ge=1, le=365)):
    """Site-level outcomes: conversations, connections, testimonials, fit scores, navigation."""
    try:
        return get_outcomes(days=days)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch outcomes: {e}")


@router.get("/training", response_model=dict)
async def training_stats():
    """Training data overview."""
    try:
        return get_training_stats()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch training stats: {e}"
        )
