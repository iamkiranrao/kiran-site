"""
Visual Audit Router - Endpoints for scanning site HTML for visual rule violations.

Endpoints:
  GET  /rules            - View visual rules (section 7 of CONTENT-RULES.md)
  GET  /files            - List all auditable HTML files
  POST /audit            - Audit a single file
  POST /audit-all        - Audit all files (full site scan)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.visual_audit_service import (
    get_visual_rules,
    list_auditable_files,
    visual_audit_file,
    visual_audit_all,
)


router = APIRouter()


class VisualAuditRequest(BaseModel):
    file_path: str


@router.get("/rules")
async def view_visual_rules():
    """Return visual rules from CONTENT-RULES.md."""
    return {"rules": get_visual_rules()}


@router.get("/files")
async def view_files():
    """Return list of all auditable site files."""
    files = list_auditable_files()
    return {"count": len(files), "files": files}


@router.post("/audit")
async def run_visual_audit(req: VisualAuditRequest):
    """Audit a single file for visual rule violations."""
    result = visual_audit_file(req.file_path)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/audit-all")
async def run_full_visual_audit():
    """Audit all site files for visual violations - full scan."""
    return visual_audit_all()
