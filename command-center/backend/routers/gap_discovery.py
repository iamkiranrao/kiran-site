"""
Gap Discovery Router — Analyze JDs against the career vault to find coverage gaps.

Endpoints:
  POST /analyze                  — Analyze a single JD → gap report
  POST /batch                    — Analyze multiple JDs → aggregated structural gaps
  GET  /reports                  — List all saved reports
  GET  /reports/{id}             — Get a specific report
  GET  /coverage-summary         — Aggregate coverage across all analyzed JDs
  POST /backfill-canonical-keys  — Add canonical keys to existing reports (one-time)
  POST /link                     — Link a gap to an initiative (close the loop)
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional

from anthropic import Anthropic

from utils.config import resolve_api_key, get_logger
from utils.exceptions import NotFoundError, ExternalServiceError
from models.gap_discovery import GapAnalysisRequest, BatchAnalysisRequest
from services.gap_discovery_service import (
    generate_report,
    analyze_batch,
    get_report,
    list_reports,
    get_coverage_summary,
    link_gap_to_initiative,
    backfill_canonical_keys,
)

logger = get_logger(__name__)

router = APIRouter()


# ── Single JD Analysis ──────────────────────────────────────────


@router.post("/analyze", response_model=dict)
async def analyze_jd(
    body: GapAnalysisRequest,
    x_claude_key: Optional[str] = Header(None),
):
    """Analyze a single job description and generate a gap coverage report."""
    api_key = resolve_api_key(x_claude_key)
    client = Anthropic(api_key=api_key)

    try:
        report = generate_report(
            client,
            jd_text=body.jd_text,
            company=body.company,
            role_title=body.role_title,
            seniority_level=body.seniority_level,
            role_focus=body.role_focus,
            push_to_gap_table=body.push_to_gap_table,
        )
        return report
    except ExternalServiceError as e:
        raise HTTPException(502, f"External service error: {e.message}")
    except Exception as e:
        logger.error(f"Gap analysis failed: {e}")
        raise HTTPException(500, f"Analysis failed: {str(e)}")


# ── Batch Analysis (Phase 4) ───────────────────────────────────


@router.post("/batch", response_model=dict)
async def analyze_batch_jds(
    body: BatchAnalysisRequest,
    x_claude_key: Optional[str] = Header(None),
):
    """Analyze multiple JDs to identify structural gap patterns."""
    api_key = resolve_api_key(x_claude_key)
    client = Anthropic(api_key=api_key)

    try:
        report = analyze_batch(
            client,
            jds=[jd.model_dump() for jd in body.jds],
            push_to_gap_table=body.push_to_gap_table,
        )
        return report
    except ExternalServiceError as e:
        raise HTTPException(502, f"External service error: {e.message}")
    except Exception as e:
        logger.error(f"Batch analysis failed: {e}")
        raise HTTPException(500, f"Batch analysis failed: {str(e)}")


# ── Report Retrieval ────────────────────────────────────────────


@router.get("/reports", response_model=dict)
async def reports_list(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    seniority_level: Optional[str] = Query(None),
    role_focus: Optional[str] = Query(None),
):
    """List all saved gap analysis reports. Optionally filter by lens."""
    return list_reports(
        limit=limit, offset=offset,
        seniority_level=seniority_level, role_focus=role_focus,
    )


@router.get("/reports/{report_id}", response_model=dict)
async def report_get(report_id: str):
    """Get a specific gap analysis report by ID."""
    report = get_report(report_id)
    if not report:
        raise HTTPException(404, f"Report '{report_id}' not found")
    return report


# ── Coverage Summary ────────────────────────────────────────────


@router.get("/coverage-summary", response_model=dict)
async def coverage_summary(
    seniority_level: Optional[str] = Query(None),
    role_focus: Optional[str] = Query(None),
):
    """Aggregate coverage analysis across all analyzed JDs. Optionally filter by lens."""
    return get_coverage_summary(
        seniority_level=seniority_level, role_focus=role_focus,
    )


# ── Canonical Key Backfill ──────────────────────────────────────


@router.post("/backfill-canonical-keys", response_model=dict)
async def backfill_keys(
    x_claude_key: Optional[str] = Header(None),
):
    """Add Claude-generated canonical_key to all existing report requirements.

    Reads each saved report, sends requirements lacking canonical_key to Claude
    for classification, then writes the keys back into the report JSON files.
    One Claude call per report (~$0.01-0.02 each).
    """
    api_key = resolve_api_key(x_claude_key)
    client = Anthropic(api_key=api_key)

    try:
        result = backfill_canonical_keys(client)
        return result
    except ExternalServiceError as e:
        raise HTTPException(502, f"External service error: {e.message}")
    except Exception as e:
        logger.error(f"Backfill failed: {e}")
        raise HTTPException(500, f"Backfill failed: {str(e)}")


# ── Gap ↔ Initiative Linkage ────────────────────────────────────


from pydantic import BaseModel, Field


class ResumeGapItem(BaseModel):
    title: str = Field(..., description="Gap title from resume analysis")
    category: str = Field("adjacent-skill", description="Gap category")
    priority: str = Field("medium", description="high or medium")
    description: str = Field("", description="What's missing")
    company: str = Field("", description="Target company from JD")
    role: str = Field("", description="Target role from JD")
    fill_tier: Optional[str] = Field(None, description="articulate|build-proof|certify|true-gap")
    fill_action: Optional[str] = Field(None, description="Recommended action")
    fill_time_estimate: Optional[str] = Field(None, description="Time estimate")


class ResumeGapPushRequest(BaseModel):
    gaps: list[ResumeGapItem] = Field(..., description="Gaps discovered during resume analysis")
    source_company: str = Field(..., description="Company the resume was customized for")
    source_role: str = Field("", description="Role title")


class GapInitiativeLinkRequest(BaseModel):
    gap_id: str = Field(..., description="ID of the gap item in evidence_gap_items")
    initiative_id: str = Field(..., description="ID of the career initiative")


@router.post("/resume-gaps", response_model=dict)
async def push_resume_gaps(body: ResumeGapPushRequest):
    """Push gaps discovered during resume customization into Mind the Gap.

    Called by the customize-resume skill after generating a match score doc.
    Deduplicates against existing gap items by title.
    """
    import uuid
    from services.evidence_service import list_gap_items, create_gap_item

    existing = list_gap_items()
    existing_titles = {item["title"].lower() for item in existing.get("entries", [])}

    created = 0
    skipped = 0
    for gap in body.gaps:
        if gap.title.lower() in existing_titles:
            skipped += 1
            continue

        gap_id = f"resume-{str(uuid.uuid4())[:6]}"
        try:
            create_gap_item(
                id=gap_id,
                title=gap.title,
                category=gap.category,
                priority=gap.priority,
                description=gap.description,
                why_it_matters=f"Gap identified during resume customization for {body.source_company} {body.source_role}".strip(),
                current_status="not-started",
                discovered_from="resume-analysis",
                source_jd_company=body.source_company,
                source_jd_role=body.source_role,
                fill_tier=gap.fill_tier,
                fill_action=gap.fill_action,
                fill_time_estimate=gap.fill_time_estimate,
                tags=[body.source_company.lower().replace(" ", "-")] if body.source_company else [],
                sort_order=0,
            )
            existing_titles.add(gap.title.lower())
            created += 1
        except Exception as e:
            logger.warning(f"Failed to create resume gap '{gap_id}': {e}")

    return {
        "created": created,
        "skipped": skipped,
        "total_submitted": len(body.gaps),
        "source": f"resume-analysis:{body.source_company}",
    }


@router.post("/link", response_model=dict)
async def link_gap_initiative(body: GapInitiativeLinkRequest):
    """Link a Mind the Gap item to a career initiative (mark gap as closed)."""
    try:
        return link_gap_to_initiative(
            gap_id=body.gap_id,
            initiative_id=body.initiative_id,
        )
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Failed to link gap {body.gap_id} to initiative {body.initiative_id}: {e}")
        raise HTTPException(500, str(e))
