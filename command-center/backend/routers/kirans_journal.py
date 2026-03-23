"""
Kiran's Journal API — Strategic thinking, decisions, apprehensions, and ideas.

This is Kiran's own lens on his thinking — different from Fenix Journal
(which is Fenix's perspective on Kiran). This captures:
- Career strategy decisions and reasoning
- Product philosophy and positioning
- Content strategy and gating decisions
- Brand/identity evolution
- Architecture strategy and tradeoffs
- Apprehensions, tensions, and open questions
- Principles crystallized from experience

Stored as a flat JSON file. No external dependencies.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from models.kirans_journal import JournalEntryCreate, JournalEntryUpdate

from utils.config import data_dir

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

JOURNAL_FILE = os.path.join(data_dir("kirans_journal"), "entries.json")

# Seed file shipped with the repo (backfilled entries)
_SEED_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "kirans_journal", "entries.json"
)

# Session archive directory (markdown transcripts)
# routers/ -> backend/ -> command-center/ -> project root (Kiran's Website)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SESSION_ARCHIVE_DIR = os.path.join(_PROJECT_ROOT, "fenix-journal", "session-archive")

# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(JOURNAL_FILE):
        with open(JOURNAL_FILE) as f:
            return json.load(f)
    return []

def _save(data: list):
    os.makedirs(os.path.dirname(JOURNAL_FILE), exist_ok=True)
    with open(JOURNAL_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ── Models ───────────────────────────────────────────────────────

VALID_CATEGORIES = [
    "career-strategy",
    "product-philosophy",
    "content-strategy",
    "brand-identity",
    "architecture",
    "apprehension",
    "principle",
    "idea",
    "general",
]

# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_entries(
    category: Optional[str] = None,
    workstream: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List journal entries, optionally filtered."""
    entries = _load()

    if category:
        entries = [e for e in entries if e.get("category") == category]
    if workstream:
        entries = [e for e in entries if workstream in e.get("workstreams", [])]
    if status:
        entries = [e for e in entries if e.get("status") == status]
    if tag:
        entries = [e for e in entries if tag in e.get("tags", [])]
    if search:
        q = search.lower()
        entries = [
            e for e in entries
            if q in (e.get("title") or "").lower()
            or q in (e.get("body") or "").lower()
            or q in (e.get("decision") or "").lower()
        ]

    # Sort by date, newest first
    entries.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    total = len(entries)
    entries = entries[offset:offset + limit]

    return {"entries": entries, "total": total, "offset": offset, "limit": limit}

@router.post("/", response_model=dict)
def create_entry(body: JournalEntryCreate):
    """Create a new journal entry."""
    entries = _load()
    entry = {
        "id": str(uuid.uuid4())[:8],
        "title": body.title,
        "body": body.body,
        "category": body.category,
        "tags": body.tags,
        "workstreams": body.workstreams,
        "source_session": body.source_session,
        "decision": body.decision,
        "alternatives_considered": body.alternatives_considered,
        "open_questions": body.open_questions,
        "status": "active",
        "resolution": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    entries.append(entry)
    _save(entries)

    # Fire notification (best-effort)
    try:
        from services.notification_service import notify_new_journal_entry
        notify_new_journal_entry(entry["id"], entry["title"], entry["category"])
    except Exception as e:
        logger.warning("Failed to create journal entry notification: %s", e)

    return entry

@router.put("/{entry_id}", response_model=dict)
def update_entry(entry_id: str, body: JournalEntryUpdate):
    """Update an existing journal entry."""
    entries = _load()
    for entry in entries:
        if entry["id"] == entry_id:
            for field, value in body.model_dump(exclude_none=True).items():
                entry[field] = value
            entry["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save(entries)
            return entry
    raise HTTPException(status_code=404, detail="Entry not found")

@router.delete("/{entry_id}", response_model=dict)
def delete_entry(entry_id: str):
    """Delete a journal entry."""
    entries = _load()
    filtered = [e for e in entries if e["id"] != entry_id]
    if len(filtered) == len(entries):
        raise HTTPException(status_code=404, detail="Entry not found")
    _save(filtered)
    return {"deleted": entry_id}

@router.get("/categories", response_model=dict)
def list_categories():
    """Return distinct categories and their counts."""
    entries = _load()
    cats = {}
    for entry in entries:
        cat = entry.get("category", "general")
        cats[cat] = cats.get(cat, 0) + 1
    return {"categories": cats}

@router.get("/workstreams", response_model=dict)
def list_workstreams():
    """Return distinct workstreams and their entry counts."""
    entries = _load()
    ws = {}
    for entry in entries:
        for workstream in entry.get("workstreams", []):
            ws[workstream] = ws.get(workstream, 0) + 1
    return {"workstreams": ws}

@router.get("/principles", response_model=dict)
def list_principles():
    """Return all crystallized principles — the distilled strategic wisdom."""
    entries = _load()
    principles = [e for e in entries if e.get("category") == "principle"]
    principles.sort(key=lambda e: e.get("created_at", ""))
    return {"principles": principles, "total": len(principles)}

@router.get("/open-questions", response_model=dict)
def list_open_questions():
    """Return entries with unresolved open questions or apprehensions."""
    entries = _load()
    open_items = [
        e for e in entries
        if (e.get("open_questions") and e.get("status") != "resolved")
        or (e.get("category") == "apprehension" and e.get("status") == "active")
    ]
    open_items.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    return {"open_questions": open_items, "total": len(open_items)}

@router.get("/source/{filename}", response_model=dict)
def get_source_transcript(filename: str):
    """Return the markdown content of a session archive transcript.

    Used by the frontend to show the original conversation context
    that a journal entry was mined from.
    """
    # Sanitize — only allow .md files, no path traversal
    if not filename.endswith(".md") or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = os.path.join(SESSION_ARCHIVE_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Session archive not found")

    with open(filepath) as f:
        content = f.read()
    return PlainTextResponse(content)
