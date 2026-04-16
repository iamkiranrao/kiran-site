"""Gap Closure Moves API — Strategic moves that batch-close gaps.

Endpoints for CRUD on moves, step toggling, progress scoring,
seeding the initial 10 moves, and batch gap resolution.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from fastapi import Header
from models.gap_moves import MoveCreate, MoveUpdate, MoveStepUpdate
from services.gap_moves_service import (
    list_moves, get_move, create_move, update_move, delete_move,
    update_step, get_progress, complete_move_and_resolve_gaps, seed_moves,
    get_company_readiness, enrich_move,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=list)
def list_all_moves(status: Optional[str] = None):
    """List all moves, optionally filtered by status."""
    moves = list_moves()
    if status:
        moves = [m for m in moves if m.get("status") == status]
    return moves


@router.get("/progress", response_model=dict)
def get_overall_progress():
    """Get aggregate progress across all moves."""
    return get_progress()


@router.get("/company-readiness", response_model=list)
def company_readiness():
    """Per-company gap readiness — how close Kiran is to covering each target company's requirements."""
    return get_company_readiness()


@router.post("/seed", response_model=dict)
def seed_initial_moves(force: bool = False):
    """Seed the 10 strategic moves. Set force=true to overwrite existing."""
    return seed_moves(force=force)


@router.post("/enrich/{move_id}", response_model=dict)
async def enrich_single_move(move_id: str, x_claude_key: Optional[str] = Header(None)):
    """Enrich a move with granular closure guidance — what_good_looks_like, vault_record_draft, interview_stories."""
    from utils.config import resolve_api_key
    import anthropic

    api_key = resolve_api_key(x_claude_key)
    if not api_key:
        raise HTTPException(500, "No Claude API key available")
    client = anthropic.Anthropic(api_key=api_key)

    try:
        return enrich_move(client, move_id)
    except Exception as e:
        logger.error(f"Failed to enrich move {move_id}: {e}")
        raise HTTPException(500, f"Enrichment failed: {str(e)}")


@router.get("/{move_id}", response_model=dict)
def get_single_move(move_id: str):
    """Get a single move with all steps."""
    return get_move(move_id)


@router.post("/", response_model=dict)
def create_new_move(data: MoveCreate):
    """Create a custom move."""
    return create_move(data.model_dump())


@router.put("/{move_id}", response_model=dict)
def update_existing_move(move_id: str, data: MoveUpdate):
    """Update move metadata (title, status, notes, gap_ids)."""
    return update_move(move_id, data.model_dump(exclude_none=True))


@router.delete("/{move_id}")
def delete_existing_move(move_id: str):
    """Delete a move."""
    delete_move(move_id)
    return {"status": "deleted", "id": move_id}


@router.put("/{move_id}/steps/{step_index}", response_model=dict)
def toggle_step(move_id: str, step_index: int, data: MoveStepUpdate):
    """Update a step's status (pending → in-progress → completed)."""
    return update_step(move_id, step_index, data.model_dump(exclude_none=True))


@router.post("/{move_id}/complete", response_model=dict)
def complete_and_resolve(move_id: str):
    """Mark a move complete and batch-resolve all linked gaps."""
    return complete_move_and_resolve_gaps(move_id)
