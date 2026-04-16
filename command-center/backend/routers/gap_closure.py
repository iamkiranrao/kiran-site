"""
Gap Closure Router — Generate and manage closure plans for identified gaps.

Endpoints:
  POST /                          — Generate a closure plan for a gap × company pair
  GET  /                          — List all saved closure plans
  GET  /prioritized               — Get gaps prioritized by impact (work queue)
  GET  /{plan_id}                 — Get a specific closure plan
  PATCH /{plan_id}/step           — Update step status (mark done/in-progress)
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional

from anthropic import Anthropic

from utils.config import resolve_api_key, get_logger
from utils.exceptions import NotFoundError, ExternalServiceError
from models.gap_closure import ClosurePlanRequest, StepStatusUpdate
from services.gap_closure_service import (
    generate_closure_plan,
    generate_interview_prep,
    get_closure_plan,
    list_closure_plans,
    update_step_status,
    get_prioritized_gaps,
)

logger = get_logger(__name__)

router = APIRouter()


# ── Generate Closure Plan ──────────────────────────────────


@router.post("/", response_model=dict)
async def create_closure_plan(
    body: ClosurePlanRequest,
    x_claude_key: Optional[str] = Header(None),
):
    """Generate a closure plan for a gap × company pair."""
    api_key = resolve_api_key(x_claude_key)
    client = Anthropic(api_key=api_key)

    try:
        plan = generate_closure_plan(
            client,
            gap_id=body.gap_id,
            target_company=body.target_company,
            role_focus=body.role_focus,
        )
        return plan
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ExternalServiceError as e:
        raise HTTPException(502, f"External service error: {e.message}")
    except Exception as e:
        logger.error(f"Closure plan generation failed: {e}")
        raise HTTPException(500, f"Plan generation failed: {str(e)}")


# ── List Plans ─────────────────────────────────────────────


@router.get("/", response_model=dict)
async def plans_list(
    gap_id: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
):
    """List all saved closure plans, optionally filtered by gap or company."""
    return list_closure_plans(gap_id=gap_id, company=company)


# ── Prioritized Gap Queue ─────────────────────────────────


@router.get("/prioritized", response_model=list)
async def prioritized_gaps():
    """Get gaps prioritized by impact — the sequenced work queue.

    Scoring: (a) how many target companies have this gap,
    (b) tier weight of affected companies (dream > target > consulting),
    (c) estimated closure difficulty (articulate > build-proof > certify > true-gap).
    """
    try:
        return get_prioritized_gaps()
    except Exception as e:
        logger.error(f"Failed to get prioritized gaps: {e}")
        raise HTTPException(500, f"Prioritization failed: {str(e)}")


# ── Interview Prep Generation ─────────────────────────────


@router.post("/interview-prep/{gap_id}", response_model=dict)
async def create_interview_prep(
    gap_id: str,
    x_claude_key: Optional[str] = Header(None),
):
    """Generate interview questions and STAR-format answers for a gap."""
    api_key = resolve_api_key(x_claude_key)
    client = Anthropic(api_key=api_key)

    try:
        result = generate_interview_prep(client, gap_id=gap_id)
        return result
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ExternalServiceError as e:
        raise HTTPException(502, f"External service error: {e.message}")
    except Exception as e:
        logger.error(f"Interview prep generation failed: {e}")
        raise HTTPException(500, f"Interview prep failed: {str(e)}")


# ── Get Specific Plan ──────────────────────────────────────


@router.get("/{plan_id:path}", response_model=dict)
async def plan_get(plan_id: str):
    """Get a specific closure plan by ID (format: gap_id--company-slug)."""
    plan = get_closure_plan(plan_id)
    if not plan:
        raise HTTPException(404, f"Closure plan '{plan_id}' not found")
    return plan


# ── Update Step Status ─────────────────────────────────────


@router.patch("/{plan_id:path}/step", response_model=dict)
async def plan_update_step(
    plan_id: str,
    body: StepStatusUpdate,
):
    """Update the status of a specific closure step. Also logs to the closure journal."""
    try:
        plan = update_step_status(
            plan_id=plan_id,
            step_index=body.step_index,
            status=body.status.value,
            journal_note=body.journal_note,
        )
        return plan
    except NotFoundError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"Failed to update step status: {e}")
        raise HTTPException(500, str(e))
