"""
Job Radar Router — Endpoints for automated job discovery and freshness scoring.

Endpoints:
  POST   /scan                       — Run a full scan across all career pages
  GET    /jobs                       — List discovered jobs (filterable)
  GET    /jobs/{job_id}              — Get a single job posting
  PUT    /jobs/{job_id}/status       — Update job status (new, reviewing, applied, dismissed, saved)
  GET    /stats                      — Dashboard statistics
  GET    /scan-history               — Recent scan log
  GET    /companies                  — List monitored companies
  POST   /jobs/{job_id}/pipeline     — Push job to Resume Customizer pipeline
"""

from fastapi import APIRouter, HTTPException, Query
from models.job_radar import JobStatusUpdate, PipelinePush
from typing import Optional, List

from services.job_radar_service import (
    run_full_scan,
    get_all_jobs,
    get_job_by_id,
    update_job_status,
    get_scan_history,
    get_stats,
    COMPANY_CAREER_SOURCES,
    freshness_label,
    compute_fit_score,
)
from services.job_central_service import add_application

router = APIRouter()

# ── Request models ─────────────────────────────────────────────────

# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/scan", response_model=dict)
async def trigger_scan():
    """Run a full scan across all monitored company career pages."""
    result = await run_full_scan()
    return result

@router.get("/jobs", response_model=dict)
async def list_jobs(
    freshness: Optional[str] = None,
    company: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[List[str]] = Query(None, description="Location groups: bay_area, remote, uk, australia, uae, other_us"),
    min_salary: Optional[int] = Query(None, description="Minimum salary for US jobs. International/remote jobs bypass this filter."),
    max_salary: Optional[int] = Query(None, description="Maximum salary for US jobs."),
    fit_label: Optional[str] = Query(None, description="Fit label: Excellent, Strong, Good, Moderate, Low"),
    min_fit_score: Optional[int] = Query(None, ge=0, le=100, description="Minimum fit score (0-100)"),
    company_tier: Optional[str] = Query(None, description="Company tier: dream, high-prob, practice"),
    source: Optional[str] = Query(None, description="Source: greenhouse, lever, ashby, remotive, themuse, adzuna"),
    has_salary: Optional[bool] = Query(None, description="True = only jobs with salary, False = only without"),
    seniority: Optional[str] = Query(None, description="Title keyword: senior, staff, principal, group, director, vp, head"),
    exclude_banks: Optional[bool] = Query(None, description="True = hide bank/financial institution roles"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=0, description="Results per page. 0 = all results (no pagination)."),
):
    """List discovered jobs with filters, sorted by rank_score. Paginated, 25 per page by default."""
    result = get_all_jobs(
        freshness_filter=freshness,
        company_filter=company,
        status_filter=status,
        location_groups=location,
        min_salary=min_salary,
        max_salary=max_salary,
        fit_label=fit_label,
        min_fit_score=min_fit_score,
        company_tier=company_tier,
        source=source,
        has_salary=has_salary,
        seniority=seniority,
        exclude_banks=exclude_banks,
        page=page,
        page_size=page_size,
    )
    # Enrich with freshness labels
    for job in result["jobs"]:
        from services.job_radar_service import Freshness
        try:
            job["freshness_label"] = freshness_label(Freshness(job.get("freshness", "stale")))
        except ValueError:
            job["freshness_label"] = "Unknown"
    return result

@router.get("/jobs/{job_id}", response_model=dict)
async def get_job(job_id: str):
    """Get a single discovered job posting with full details."""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    from services.job_radar_service import Freshness
    try:
        job["freshness_label"] = freshness_label(Freshness(job.get("freshness", "stale")))
    except ValueError:
        job["freshness_label"] = "Unknown"
    return job

@router.put("/jobs/{job_id}/status", response_model=dict)
async def change_job_status(job_id: str, body: JobStatusUpdate):
    """Update a job's status: new, reviewing, applied, dismissed, saved."""
    valid_statuses = {"new", "reviewing", "applied", "dismissed", "saved"}
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Must be one of: {', '.join(sorted(valid_statuses))}",
        )
    result = update_job_status(job_id, body.status, body.notes or "")
    if not result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return result

@router.get("/stats", response_model=dict)
async def radar_stats():
    """Get Job Radar dashboard statistics."""
    return get_stats()

@router.get("/scan-history", response_model=dict)
async def scan_history(limit: int = 20):
    """Get recent scan history."""
    history = get_scan_history(limit=limit)
    return {"history": history, "count": len(history)}

@router.get("/companies", response_model=dict)
async def list_companies():
    """List all monitored companies with their ATS info."""
    companies = [
        {
            "company": s["company"],
            "ats": s["ats"],
            "careers_url": s["careers_url"],
        }
        for s in COMPANY_CAREER_SOURCES
    ]
    return {"companies": companies, "count": len(companies)}

@router.post("/jobs/{job_id}/pipeline", response_model=dict)
async def push_to_pipeline(job_id: str, body: PipelinePush):
    """
    Push a discovered job through the full pipeline:
    1. Mark radar job as 'applied'
    2. Create a Job Central application entry for tracking
    3. Return pre-fill data for the Resume Customizer
    """
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # Mark radar job as applied
    update_job_status(job_id, "applied", "Pushed to pipeline — application created in Job Central")

    # Create a Job Central application entry for tracking
    app_entry = add_application(
        company=job.get("company", ""),
        role=job.get("title", ""),
        tier=body.tier or "high-prob",
        url=job.get("url", ""),
        notes=f"Source: Job Radar | Freshness: {job.get('freshness', 'unknown')} | Radar ID: {job_id}",
    )

    # Return pre-fill data for the Resume Customizer
    return {
        "pipeline_ready": True,
        "application_id": app_entry.get("id"),
        "prefill": {
            "company": job.get("company", ""),
            "role": job.get("title", ""),
            "url": job.get("url", ""),
            "persona": body.persona or "pm",
            "length": body.length or "2pager",
            "source": "job_radar",
            "job_radar_id": job_id,
            "application_id": app_entry.get("id"),
        },
        "resume_customizer_url": "/dashboard/resume",
        "message": f"Application created and ready to customize resume for {job.get('title', '')} at {job.get('company', '')}",
    }
