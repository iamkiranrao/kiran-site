"""
Action Items API — Unified task tracker across all workstreams.

Catches things that slip through the cracks when working across many
sandboxes simultaneously. Items come from:
- Session captures (explicit and implicit commitments)
- Module docs (remaining work sections)
- Manual entry

Each item tracks source, workstream, priority, status, and due dates.
Stored as a flat JSON file. No external dependencies.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query

from utils.config import data_dir
from models.action_items import ActionItemCreate, ActionItemUpdate, VALID_WORKSTREAMS

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

ITEMS_FILE = os.path.join(data_dir("action_items"), "items.json")

# Seed file shipped with the repo (backfilled items)
_SEED_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "action_items", "items.json"
)


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(ITEMS_FILE):
        with open(ITEMS_FILE) as f:
            return json.load(f)
    return []


def _save(data: list):
    os.makedirs(os.path.dirname(ITEMS_FILE), exist_ok=True)
    with open(ITEMS_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_items(
    workstream: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    include_done: bool = False,
    limit: int = 100,
    offset: int = 0,
):
    """List action items, optionally filtered. Excludes done/wont-do by default."""
    items = _load()

    if not include_done:
        items = [i for i in items if i.get("status") not in ("done", "wont-do")]
    if workstream:
        items = [i for i in items if i.get("workstream") == workstream]
    if priority:
        items = [i for i in items if i.get("priority") == priority]
    if status:
        items = [i for i in items if i.get("status") == status]
    if tag:
        items = [i for i in items if tag in i.get("tags", [])]
    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i.get("title", "").lower()
            or q in i.get("description", "").lower()
        ]

    # Sort: critical first, then high, medium, low; within priority, oldest first
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    items.sort(key=lambda i: (
        priority_order.get(i.get("priority", "medium"), 2),
        i.get("created_at", ""),
    ))

    total = len(items)
    items = items[offset:offset + limit]

    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.post("/", response_model=dict)
def create_item(body: ActionItemCreate):
    """Create a new action item."""
    items = _load()
    item = {
        "id": str(uuid.uuid4())[:8],
        "title": body.title,
        "description": body.description,
        "workstream": body.workstream,
        "priority": body.priority,
        "status": "todo",
        "source": body.source,
        "due_date": body.due_date,
        "tags": body.tags,
        "blocked_by": body.blocked_by,
        "completed_at": None,
        "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    items.append(item)
    _save(items)

    # Fire notification (best-effort, don't fail the create if Supabase is down)
    try:
        from services.notification_service import notify_new_action_item
        notify_new_action_item(item["id"], item["title"], item["priority"], item["workstream"])
    except Exception as e:
        logger.warning("Failed to create action item notification: %s", e)

    return item


@router.post("/bulk", response_model=dict)
def create_items_bulk(items_data: List[ActionItemCreate]):
    """Create multiple action items at once (for backfill)."""
    items = _load()
    created = []
    for body in items_data:
        item = {
            "id": str(uuid.uuid4())[:8],
            "title": body.title,
            "description": body.description,
            "workstream": body.workstream,
            "priority": body.priority,
            "status": "todo",
            "source": body.source,
            "due_date": body.due_date,
            "tags": body.tags,
            "blocked_by": body.blocked_by,
            "completed_at": None,
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        items.append(item)
        created.append(item)
    _save(items)
    return {"created": len(created), "items": created}


@router.put("/{item_id}", response_model=dict)
def update_item(item_id: str, body: ActionItemUpdate):
    """Update an existing action item."""
    items = _load()
    for item in items:
        if item["id"] == item_id:
            for field, value in body.model_dump(exclude_none=True).items():
                item[field] = value
            # Auto-set completed_at when status changes to done
            if body.status == "done" and not item.get("completed_at"):
                item["completed_at"] = datetime.now(timezone.utc).isoformat()
            item["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save(items)
            return item
    raise HTTPException(status_code=404, detail="Item not found")


@router.put("/{item_id}/complete", response_model=dict)
def complete_item(item_id: str):
    """Quick-complete an action item."""
    items = _load()
    for item in items:
        if item["id"] == item_id:
            item["status"] = "done"
            item["completed_at"] = datetime.now(timezone.utc).isoformat()
            item["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save(items)
            return item
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/{item_id}", response_model=dict)
def delete_item(item_id: str):
    """Delete an action item."""
    items = _load()
    filtered = [i for i in items if i["id"] != item_id]
    if len(filtered) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    _save(filtered)
    return {"deleted": item_id}


@router.get("/workstreams", response_model=dict)
def list_workstreams():
    """Return workstreams with open item counts."""
    items = _load()
    open_items = [i for i in items if i.get("status") not in ("done", "wont-do")]
    ws = {}
    for item in open_items:
        workstream = item.get("workstream", "cross-cutting")
        ws[workstream] = ws.get(workstream, 0) + 1
    return {"workstreams": ws}


@router.get("/summary", response_model=dict)
def get_summary():
    """Dashboard summary — counts by status and priority."""
    items = _load()

    status_counts = {}
    priority_counts = {}
    overdue = 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for item in items:
        s = item.get("status", "todo")
        p = item.get("priority", "medium")
        status_counts[s] = status_counts.get(s, 0) + 1
        if s not in ("done", "wont-do"):
            priority_counts[p] = priority_counts.get(p, 0) + 1
        if item.get("due_date") and item["due_date"] < today and s not in ("done", "wont-do"):
            overdue += 1

    return {
        "total": len(items),
        "open": sum(1 for i in items if i.get("status") not in ("done", "wont-do")),
        "by_status": status_counts,
        "by_priority": priority_counts,
        "overdue": overdue,
    }


@router.get("/blocked", response_model=dict)
def list_blocked():
    """Return all blocked items."""
    items = _load()
    blocked = [i for i in items if i.get("status") == "blocked"]
    return {"blocked": blocked, "total": len(blocked)}
