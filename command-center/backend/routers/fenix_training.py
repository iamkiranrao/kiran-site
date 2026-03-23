"""
Fenix Training Router — structured Q&A interview to teach Fenix personal knowledge.

Endpoints:
  POST   /training/start                     — begin a new training session (generates 100 questions)
  GET    /training/categories                 — list training categories
  GET    /training/sessions                   — list all training sessions
  GET    /training/sessions/{id}              — get session state
  GET    /training/sessions/{id}/current      — get current question
  POST   /training/sessions/{id}/answer       — submit answer (triggers editorial pass)
  POST   /training/sessions/{id}/approve      — approve polished answer → save to Supabase
  POST   /training/sessions/{id}/skip         — skip current question
  GET    /training/data                       — list all training data entries
  PUT    /training/data/{id}                  — edit an entry
  DELETE /training/data/{id}                  — remove an entry
"""

import os
from utils.config import resolve_api_key
from fastapi import APIRouter, HTTPException, Header, Query
from models.fenix_training import AnswerRequest, ApproveRequest, UpdateEntryRequest, QuestionBankApproveRequest, ManualInputRequest, ProductionReadyRequest
from typing import Optional

from services.fenix_training_service import (
    create_training_session,
    list_training_sessions,
    get_training_session,
    get_current_question,
    generate_draft_answer,
    answer_question,
    approve_question,
    skip_question,
    list_training_data,
    update_training_entry,
    delete_training_entry,
    get_categories,
    get_question_bank_questions,
    get_question_bank_meta,
    generate_question_bank_answer,
    approve_question_bank_answer,
    save_manual_training_entry,
    make_production_ready,
    get_answered_questions,
)

router = APIRouter()

# ── Request models ────────────────────────────────────────────────────

# ── Helpers ───────────────────────────────────────────────────────────

@router.post("/training/start", response_model=dict)
async def start_session(
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
):
    """Begin a new training session (generates 100 questions)."""
    api_key = resolve_api_key(x_claude_key)
    try:
        return create_training_session(api_key=api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {e}")

@router.get("/training/categories", response_model=dict)
async def categories():
    """List training categories."""
    return {"categories": get_categories()}

@router.get("/training/sessions", response_model=dict)
async def sessions():
    """List all training sessions."""
    try:
        return {"sessions": list_training_sessions()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {e}")

@router.get("/training/sessions/{session_id}", response_model=dict)
async def session_detail(session_id: str):
    """Get full session state."""
    state = get_training_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return state

@router.get("/training/sessions/{session_id}/current", response_model=dict)
async def current_question(session_id: str):
    """Get the current question in the session."""
    result = get_current_question(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return result

@router.get("/training/sessions/{session_id}/generate-draft", response_model=dict)
async def generate_draft(
    session_id: str,
    regenerate: bool = Query(False),
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
):
    """Generate a draft answer for the current question in the session."""
    api_key = resolve_api_key(x_claude_key)
    try:
        return generate_draft_answer(session_id, api_key=api_key, regenerate=regenerate)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate draft: {e}")

@router.post("/training/sessions/{session_id}/answer", response_model=dict)
async def submit_answer(
    session_id: str,
    request: AnswerRequest,
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
):
    """Submit an answer to the current question. Claude does an editorial pass."""
    api_key = resolve_api_key(x_claude_key)
    try:
        result = answer_question(session_id, request.answer, api_key=api_key)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process answer: {e}")

@router.post("/training/sessions/{session_id}/approve", response_model=dict)
async def approve(session_id: str, request: ApproveRequest):
    """Approve polished answer and save to Supabase training_data."""
    try:
        result = approve_question(session_id, edited_pairs=request.edited_pairs)

        # Fire training progress notification at milestones (every 10 approvals)
        try:
            state = get_training_session(session_id)
            if state:
                stats = state.get("stats", {})
                approved = stats.get("approved", 0)
                total = len(state.get("questions", []))
                if approved > 0 and approved % 10 == 0:
                    from services.notification_service import notify_training_progress
                    notify_training_progress(approved, total)
        except Exception:
            pass  # Fire-and-forget

        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve: {e}")

@router.post("/training/sessions/{session_id}/skip", response_model=dict)
async def skip(session_id: str):
    """Skip the current question."""
    try:
        result = skip_question(session_id)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to skip: {e}")

# ── Training data CRUD ───────────────────────────────────────────────

@router.get("/training/data", response_model=dict)
async def training_data(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all training data entries with optional filters."""
    try:
        return list_training_data(
            category=category,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list training data: {e}")

@router.put("/training/data/{entry_id}", response_model=dict)
async def update_entry(entry_id: str, request: UpdateEntryRequest):
    """Edit a training data entry."""
    try:
        return update_training_entry(
            entry_id,
            question=request.question,
            answer=request.answer,
            category=request.category,
            status=request.status,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update entry: {e}")

@router.delete("/training/data/{entry_id}", response_model=dict)
async def delete_entry(entry_id: str):
    """Delete a training data entry."""
    try:
        return delete_training_entry(entry_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {e}")

# ── Question Bank endpoints ──────────────────────────────────────────

@router.get("/training/question-bank/meta", response_model=dict)
async def question_bank_meta():
    """Get question bank metadata (personas, dimensions, counts)."""
    return get_question_bank_meta()

@router.get("/training/question-bank", response_model=dict)
async def question_bank_list(
    persona: Optional[str] = Query(None),
    dimension: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List questions from the question bank with optional filters."""
    return get_question_bank_questions(
        persona=persona, dimension=dimension, limit=limit, offset=offset
    )

@router.get("/training/question-bank/{question_id}/generate", response_model=dict)
async def question_bank_generate(
    question_id: str,
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
):
    """Generate best answer example + customized draft for a question."""
    api_key = resolve_api_key(x_claude_key)
    try:
        return generate_question_bank_answer(question_id, api_key=api_key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {e}")

@router.post("/training/question-bank/{question_id}/approve", response_model=dict)
async def question_bank_approve(
    question_id: str,
    request: QuestionBankApproveRequest,
):
    """Approve and save a question bank answer to training data."""
    try:
        return approve_question_bank_answer(
            question_id=question_id,
            question_text=request.question_text,
            answer_text=request.answer_text,
            category=request.category,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve: {e}")

@router.post("/training/manual", response_model=dict)
async def manual_training_input(request: ManualInputRequest):
    """Save a manually entered question-answer pair to training data."""
    if not request.question.strip() or not request.answer.strip():
        raise HTTPException(status_code=400, detail="Both question and answer are required")
    try:
        return save_manual_training_entry(
            question=request.question,
            answer=request.answer,
            category=request.category or "manual",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {e}")

@router.post("/training/production-ready", response_model=dict)
async def production_ready(
    request: ProductionReadyRequest,
    x_claude_key: Optional[str] = Header(None, alias="X-Claude-Key"),
):
    """Run content rules check and convert Q&A to Fenix's production voice."""
    if not request.question.strip() or not request.answer.strip():
        raise HTTPException(status_code=400, detail="Both question and answer are required")
    api_key = resolve_api_key(x_claude_key)
    try:
        return make_production_ready(
            question=request.question,
            answer=request.answer,
            api_key=api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process: {e}")
