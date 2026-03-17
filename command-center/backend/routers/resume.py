"""
Resume Router — SSE pipeline endpoint + file download endpoints + URL extraction + proposal workflow.
"""

import os
from utils.config import resolve_api_key, VALID_PERSONAS, VALID_VERSIONS
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, field_validator
from typing import Optional



from services.resume_pipeline import run_pipeline, run_analysis_phase, run_generation_phase, get_job_file, list_job_files, get_proposal, update_proposal_feedback, refine_proposal_section, discuss_proposal_section, lock_section, get_tracker, start_parallel_doc_generation
from services.jd_extractor import extract_jd_from_url

router = APIRouter()

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")


class ResumeRequest(BaseModel):
    job_description: str
    persona: Optional[str] = "auto"  # PM, PjM, PMM, or auto
    version: Optional[str] = "2-Page"  # 1-Page, 2-Page, Detailed

    @field_validator("persona")
    @classmethod
    def check_persona(cls, v):
        if v and v not in VALID_PERSONAS:
            raise ValueError(f"persona must be one of {sorted(VALID_PERSONAS)}, got '{v}'")
        return v

    @field_validator("version")
    @classmethod
    def check_version(cls, v):
        if v and v not in VALID_VERSIONS:
            raise ValueError(f"version must be one of {sorted(VALID_VERSIONS)}, got '{v}'")
        return v


class URLExtractRequest(BaseModel):
    url: str


class AnalyzeRequest(BaseModel):
    job_description: str
    persona: Optional[str] = "auto"
    version: Optional[str] = "2-Page"

    @field_validator("persona")
    @classmethod
    def check_persona(cls, v):
        if v and v not in VALID_PERSONAS:
            raise ValueError(f"persona must be one of {sorted(VALID_PERSONAS)}, got '{v}'")
        return v

    @field_validator("version")
    @classmethod
    def check_version(cls, v):
        if v and v not in VALID_VERSIONS:
            raise ValueError(f"version must be one of {sorted(VALID_VERSIONS)}, got '{v}'")
        return v


class ApproveRequest(BaseModel):
    job_id: str
    feedback: Optional[str] = None  # Optional user feedback to refine before generation


class RefineSectionRequest(BaseModel):
    job_id: str
    section_id: str
    feedback: str


class DiscussSectionRequest(BaseModel):
    job_id: str
    section_id: str
    message: str
    conversation_history: Optional[list] = []  # [{role: "user"|"assistant", content: str}]


class LockSectionRequest(BaseModel):
    job_id: str
    section_id: str


# ── URL Extraction ───────────────────────────────────────────────────────────

@router.post("/extract-url")
async def extract_jd(request: URLExtractRequest):
    """Extract job description text from a URL."""
    if not request.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")

    result = await extract_jd_from_url(request.url.strip())

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])

    return {
        "text": result["text"],
        "platform": result["platform"],
        "url": result["url"],
    }


# ── Phase 1: Analysis + Proposal (SSE) ──────────────────────────────────────

@router.post("/analyze")
async def analyze_and_propose(
    request: AnalyzeRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """
    Phase 1: Analyze JD, research company, generate proposal with suggested changes.
    Returns SSE stream of progress events, ending with a proposal for user review.
    """
    api_key = resolve_api_key(x_claude_key)

    async def event_stream():
        async for event_json in run_analysis_phase(
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


# ── Phase 2: Get/Update Proposal + Section Review ───────────────────────────

@router.get("/proposal/{job_id}")
async def get_proposal_endpoint(job_id: str):
    """Get the saved proposal for a job."""
    proposal = get_proposal(job_id)
    if not proposal:
        raise HTTPException(status_code=404, detail=f"No proposal found for job {job_id}")
    return proposal


@router.post("/refine-section")
async def refine_section_endpoint(
    request: RefineSectionRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Refine a single section of the proposal based on user feedback."""
    api_key = resolve_api_key(x_claude_key)
    result = await refine_proposal_section(
        job_id=request.job_id,
        section_id=request.section_id,
        feedback=request.feedback,
        api_key=api_key,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/discuss-section")
async def discuss_section_endpoint(
    request: DiscussSectionRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Conversational review of a section — ask questions, get rationale, or request changes."""
    api_key = resolve_api_key(x_claude_key)
    result = await discuss_proposal_section(
        job_id=request.job_id,
        section_id=request.section_id,
        message=request.message,
        conversation_history=request.conversation_history or [],
        api_key=api_key,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/lock-section")
async def lock_section_endpoint(request: LockSectionRequest):
    """Mark a section as approved/locked."""
    result = lock_section(request.job_id, request.section_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Parallel Doc Generation ──────────────────────────────────────────────────

class ParallelGenRequest(BaseModel):
    job_id: str


@router.post("/parallel-generate")
async def parallel_generate(
    request: ParallelGenRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Start parallel generation of cover letter, brief, and interview questions during review."""
    api_key = resolve_api_key(x_claude_key)
    result = await start_parallel_doc_generation(request.job_id, api_key)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Application Tracker ─────────────────────────────────────────────────────

@router.get("/tracker")
async def get_application_tracker():
    """Get all application tracker entries."""
    return {"entries": get_tracker()}


# ── Phase 3: Approve + Generate (SSE) ───────────────────────────────────────

@router.post("/approve")
async def approve_and_generate(
    request: ApproveRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """
    Phase 3: User approved the proposal. Run generation with the approved strategy.
    If feedback is provided, it will be incorporated before generating.
    """
    api_key = resolve_api_key(x_claude_key)

    # Save feedback if provided
    if request.feedback:
        update_proposal_feedback(request.job_id, request.feedback)

    async def event_stream():
        async for event_json in run_generation_phase(
            job_id=request.job_id,
            api_key=api_key,
            feedback=request.feedback,
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


# ── Original full pipeline (kept for backwards compat) ──────────────────────

@router.post("/generate")
async def generate_resume(
    request: ResumeRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Run the 12-step resume customization pipeline via SSE."""
    api_key = resolve_api_key(x_claude_key)

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
