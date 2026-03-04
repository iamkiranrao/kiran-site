"""
Resume Router — SSE pipeline endpoint + file download endpoints.
"""

import os
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import Optional


def _resolve_api_key(header_key: Optional[str]) -> str:
    """Use header key if provided, otherwise fall back to env var."""
    if header_key and header_key.startswith("sk-ant-"):
        return header_key
    env_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if env_key and env_key.startswith("sk-ant-"):
        return env_key
    raise HTTPException(status_code=401, detail="No valid Claude API key found. Set ANTHROPIC_API_KEY in backend/.env or provide X-Claude-Key header.")

from services.resume_pipeline import run_pipeline, get_job_file, list_job_files

router = APIRouter()

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


class ResumeRequest(BaseModel):
    job_description: str
    persona: Optional[str] = "auto"  # PM, PjM, PMM, or auto
    version: Optional[str] = "2-Page"  # 1-Page, 2-Page, Detailed


@router.post("/generate")
async def generate_resume(
    request: ResumeRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Run the 12-step resume customization pipeline via SSE."""
    api_key = _resolve_api_key(x_claude_key)

    async def event_stream():
        async for event_json in run_pipeline(
            jd_text=request.job_description,
            persona=request.persona or "auto",
            version=request.version or "2-Page",
            api_key=api_key,
        ):
            yield f"data: {event_json}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/download/{job_id}/{filename}")
async def download_file(job_id: str, filename: str):
    """Download a specific file from a completed job."""
    try:
        path = get_job_file(job_id, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    media_type = (
        "application/zip" if filename.endswith(".zip")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    return FileResponse(
        path=path,
        filename=filename,
        media_type=media_type,
    )


@router.get("/jobs/{job_id}/files")
async def list_files(job_id: str):
    """List all files in a completed job."""
    files = list_job_files(job_id)
    if not files:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return {"job_id": job_id, "files": files}


@router.get("/templates")
async def list_templates():
    """List available resume templates."""
    templates = []
    for persona in ["PM", "PjM", "PMM"]:
        versions = []
        for version, suffix in [("1-Page", "1Pager"), ("2-Page", "2Pager"), ("Detailed", "Detailed")]:
            fname = f"{persona}_{suffix}.docx"
            exists = os.path.exists(os.path.join(TEMPLATES_DIR, fname))
            versions.append({"version": version, "filename": fname, "available": exists})
        templates.append({"persona": persona, "versions": versions})
    return {"templates": templates}
