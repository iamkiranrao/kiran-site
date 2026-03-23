"""
Tool Guides Router — endpoints for external tool help guides.
"""

from fastapi import APIRouter, HTTPException

from services.tool_guides_service import list_tool_guides, get_tool_guide

router = APIRouter()


@router.get("", response_model=dict)
async def tool_guides_list():
    """List all tool guides with metadata."""
    return list_tool_guides()


@router.get("/{slug}", response_model=dict)
async def tool_guide_detail(slug: str):
    """Get full content of a specific tool guide."""
    guide = get_tool_guide(slug)
    if not guide:
        raise HTTPException(status_code=404, detail=f"Tool guide not found: {slug}")
    return guide
