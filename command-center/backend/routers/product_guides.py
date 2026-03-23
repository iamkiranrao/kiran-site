"""
Product Guides Router — endpoints for browsing product module guides.
"""

from fastapi import APIRouter, HTTPException

from services.product_guides_service import (
    list_guides,
    get_guide,
    get_guides_stats,
)

router = APIRouter()


@router.get("/stats", response_model=dict)
async def guides_stats():
    """Summary stats about the product guides."""
    return get_guides_stats()


@router.get("", response_model=dict)
async def guides_list():
    """List all product guides with metadata."""
    return list_guides()


@router.get("/{slug}", response_model=dict)
async def guide_detail(slug: str):
    """Get full content of a specific product guide."""
    guide = get_guide(slug)
    if not guide:
        raise HTTPException(status_code=404, detail=f"Guide not found: {slug}")
    return guide
