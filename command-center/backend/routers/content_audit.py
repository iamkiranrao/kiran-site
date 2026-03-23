"""
Content Audit Router — Endpoints for scanning site content against CONTENT-RULES.md.

Endpoints:
  GET  /rules            — View current content rules
  GET  /files            — List all auditable HTML files
  POST /audit            — Audit a single file
  POST /audit-all        — Audit all files (full site scan)
  GET  /preview/{path}   — Extract visible text from a file (preview what gets audited)
"""

import os
from utils.config import resolve_api_key
from fastapi import APIRouter, HTTPException, Header
from models.content_audit import AuditRequest
from typing import Optional

from services.content_audit_service import (
    get_rules,
    list_auditable_files,
    extract_page_content,
    audit_file,
    audit_all,
)

router = APIRouter()

# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/rules", response_model=dict)
async def view_rules():
    """Return the current CONTENT-RULES.md contents."""
    return {"rules": get_rules()}

@router.get("/files", response_model=dict)
async def view_files():
    """Return list of all auditable site files."""
    files = list_auditable_files()
    return {"count": len(files), "files": files}

@router.post("/audit", response_model=dict)
async def run_audit(
    req: AuditRequest,
    x_claude_key: Optional[str] = Header(None),
):
    """Audit a single file against content rules."""
    api_key = resolve_api_key(x_claude_key)
    result = await audit_file(api_key, req.file_path)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.post("/audit-all", response_model=dict)
async def run_full_audit(
    x_claude_key: Optional[str] = Header(None),
):
    """Audit all site files — full scan."""
    api_key = resolve_api_key(x_claude_key)
    result = await audit_all(api_key)

    # Fire content_freshness notification if violations found
    try:
        if result.get("total_violations", 0) > 0:
            stale_pages = [
                {"title": r.get("file", "Unknown"), "violations": r.get("violation_count", 0)}
                for r in result.get("results", [])
                if r.get("violation_count", 0) > 0
            ]
            from services.notification_service import notify_content_freshness
            notify_content_freshness(stale_pages)
    except Exception:
        pass  # Fire-and-forget

    return result

@router.get("/preview/{file_path:path}", response_model=dict)
async def preview_content(file_path: str):
    """Preview extracted text for a given file (what Claude would see)."""
    # Resolve relative to site root
    from pathlib import Path
    from services.content_audit_service import SITE_ROOT

    full_path = SITE_ROOT / file_path
    result = extract_page_content(str(full_path))
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
