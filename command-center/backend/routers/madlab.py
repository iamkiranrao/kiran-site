"""
MadLab Router — Prototype overview page builder.

Endpoints:
  POST   /create              — Start a new session
  GET    /sessions             — List all sessions
  GET    /sessions/{id}        — Get session state
  DELETE /sessions/{id}        — Delete a session
  PUT    /sessions/{id}/content — Save section content
  POST   /sessions/{id}/draft   — Draft content with Claude (optional)
  POST   /sessions/{id}/publish — Assemble HTML and save locally
  POST   /sessions/{id}/deploy  — Push to production via git
"""

import os
from pathlib import Path
from utils.config import resolve_api_key
from fastapi import APIRouter, Header, HTTPException
from models.madlab import CreateRequest, ContentUpdate, DraftRequest
from typing import Optional, List

from services.madlab_service import (
    CATEGORIES,
    create_session,
    get_session,
    update_session,
    delete_session,
    list_sessions,
    draft_content,
    assemble_html,
)
from services.git_handler import GitHandler

router = APIRouter()

_BACKEND_DIR = Path(__file__).resolve().parent.parent
SITE_ROOT = os.getenv(
    "KIRAN_SITE_LOCAL_FOLDER",
    str(_BACKEND_DIR.parent.parent),
)

# ── Request models ────────────────────────────────────────────────

# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/categories", response_model=dict)
async def get_categories():
    """Get list of available prototype categories."""
    return {"categories": CATEGORIES}

@router.post("/create", response_model=dict)
async def create_prototype(request: CreateRequest):
    """Create a new prototype development session."""
    session = create_session(request.project_name, request.project_slug, request.category)
    return session

@router.get("/sessions", response_model=dict)
async def get_sessions():
    """List all prototype development sessions."""
    return {"sessions": list_sessions()}

@router.get("/sessions/{session_id}", response_model=dict)
async def get_session_detail(session_id: str):
    """Get the full state of a prototype session."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return state

@router.delete("/sessions/{session_id}", response_model=dict)
async def delete_session_endpoint(session_id: str):
    """Delete a prototype session."""
    try:
        delete_session(session_id)
        return {"deleted": True}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

@router.put("/sessions/{session_id}/content", response_model=dict)
async def save_content(session_id: str, request: ContentUpdate):
    """Save section content (manual edits)."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    updated = update_session(session_id, {"content": updates})
    return updated

@router.post("/sessions/{session_id}/draft", response_model=dict)
async def draft_with_claude(
    session_id: str,
    request: DraftRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Optional: have Claude draft all section content in one call."""
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    result = await draft_content(
        api_key=api_key,
        project_name=state["project_name"],
        category=state["category"],
        extra_context=request.extra_context or "",
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Merge Claude's draft into session content
    updated = update_session(session_id, {"content": result})
    return updated

@router.post("/sessions/{session_id}/publish", response_model=dict)
async def publish_prototype(session_id: str):
    """Assemble HTML from template + content and save locally for preview."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    html_content = assemble_html(state)

    # Save to local prototypes folder
    project_slug = state["project_slug"]
    prototypes_dir = os.path.join(SITE_ROOT, "prototypes", project_slug)
    os.makedirs(prototypes_dir, exist_ok=True)
    overview_path = os.path.join(prototypes_dir, "overview.html")

    with open(overview_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    update_session(session_id, {"status": "previewing"})

    return {
        "status": "previewing",
        "local_file": f"prototypes/{project_slug}/overview.html",
    }

@router.post("/sessions/{session_id}/deploy", response_model=dict)
async def deploy_prototype(session_id: str):
    """Push locally-previewed prototype to production via git."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("previewing", "published"):
        raise HTTPException(
            status_code=400,
            detail=f"Publish first before deploying (status: {state['status']}).",
        )

    project_slug = state["project_slug"]
    overview_path = os.path.join(SITE_ROOT, "prototypes", project_slug, "overview.html")

    if not os.path.exists(overview_path):
        raise HTTPException(status_code=404, detail="Local file not found. Hit Publish first.")

    with open(overview_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    git = GitHandler()

    try:
        result = await git.publish_prototype(
            slug=project_slug,
            html_content=html_content,
            project_name=state["project_name"],
            category=state["category"],
            skills=state["content"].get("tags", []),
            themes=[],
        )
        update_session(session_id, {"status": "published"})

        # Fire notification for deployed content
        try:
            from services.notification_service import notify_draft_content
            notify_draft_content("prototype", state["project_name"], project_slug, session_id)
        except Exception:
            pass  # Fire-and-forget

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy failed: {str(e)}")
