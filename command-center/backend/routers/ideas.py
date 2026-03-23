"""
Future Ideas API — CRUD for Command Center improvement ideas / feature backlog.
Stored as a flat JSON file. No external dependencies.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from models.ideas import IdeaCreate, IdeaUpdate

from utils.config import data_dir

router = APIRouter()

IDEAS_FILE = os.path.join(data_dir("ideas"), "ideas.json")

# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(IDEAS_FILE):
        with open(IDEAS_FILE) as f:
            return json.load(f)
    return []

def _save(data: list):
    os.makedirs(os.path.dirname(IDEAS_FILE), exist_ok=True)
    with open(IDEAS_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ── Models ───────────────────────────────────────────────────────

# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_ideas(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
):
    """List all ideas, optionally filtered."""
    ideas = _load()
    if category:
        ideas = [i for i in ideas if i.get("category") == category]
    if status:
        ideas = [i for i in ideas if i.get("status") == status]
    if priority:
        ideas = [i for i in ideas if i.get("priority") == priority]

    # Sort: high priority first, then by created_at desc
    priority_order = {"high": 0, "medium": 1, "low": 2}
    ideas.sort(key=lambda i: (priority_order.get(i.get("priority", "medium"), 1), i.get("created_at", "")))

    return {"ideas": ideas, "total": len(ideas)}

@router.post("/", response_model=dict)
def create_idea(body: IdeaCreate):
    """Create a new idea."""
    ideas = _load()
    idea = {
        "id": str(uuid.uuid4())[:8],
        "title": body.title,
        "description": body.description,
        "category": body.category,
        "priority": body.priority,
        "status": "backlog",
        "estimated_effort": body.estimated_effort,
        "tags": body.tags,
        "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    ideas.append(idea)
    _save(ideas)
    return idea

@router.put("/{idea_id}", response_model=dict)
def update_idea(idea_id: str, body: IdeaUpdate):
    """Update an existing idea."""
    ideas = _load()
    for idea in ideas:
        if idea["id"] == idea_id:
            for field, value in body.model_dump(exclude_none=True).items():
                idea[field] = value
            idea["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save(ideas)
            return idea
    raise HTTPException(status_code=404, detail="Idea not found")

@router.delete("/{idea_id}", response_model=dict)
def delete_idea(idea_id: str):
    """Delete an idea."""
    ideas = _load()
    filtered = [i for i in ideas if i["id"] != idea_id]
    if len(filtered) == len(ideas):
        raise HTTPException(status_code=404, detail="Idea not found")
    _save(filtered)
    return {"deleted": idea_id}

@router.get("/categories", response_model=dict)
def list_categories():
    """Return distinct categories and their counts."""
    ideas = _load()
    cats = {}
    for idea in ideas:
        cat = idea.get("category", "general")
        cats[cat] = cats.get(cat, 0) + 1
    return {"categories": cats}
