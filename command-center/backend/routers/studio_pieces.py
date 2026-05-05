"""Studio Pieces API.

Editable notes for the Studio Illustration page. The catalog of pieces lives
in studio-illustration.html (data-key attributes). This service stores only
the per-piece note text — everything else (title, image path, dimensions,
style, inspired-by, date, tools) stays in HTML where it's SEO-relevant and
rarely changes.

Auth model:
- GET  /api/studio-pieces/         — list all (auth required, admin UI)
- GET  /api/studio-pieces/{key}    — read one (PUBLIC — the site fetches this)
- PUT  /api/studio-pieces/{key}    — upsert one (auth required)

Public read is enforced by the auth allowlist in main.py — see that file
for the exact path-matching rule. Storage is a flat JSON file keyed by
piece slug, matching the ideas.py pattern.
"""

import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from models.studio_pieces import StudioPieceUpdate
from utils.config import data_dir

router = APIRouter()

PIECES_FILE = os.path.join(data_dir("studio_pieces"), "studio_pieces.json")


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> dict:
    """Return {key: {note, updated_at}} dict. Empty if file doesn't exist."""
    if os.path.exists(PIECES_FILE):
        with open(PIECES_FILE) as f:
            return json.load(f)
    return {}


def _save(data: dict):
    os.makedirs(os.path.dirname(PIECES_FILE), exist_ok=True)
    with open(PIECES_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_pieces():
    """List every stored note. Auth required (admin UI calls this)."""
    pieces = _load()
    items = [
        {"key": k, "note": v.get("note", ""), "updated_at": v.get("updated_at")}
        for k, v in pieces.items()
    ]
    items.sort(key=lambda p: p["key"])
    return {"pieces": items, "total": len(items)}


@router.get("/{key}", response_model=dict)
def get_piece(key: str):
    """Read one piece's note. PUBLIC endpoint — the studio page calls this.
    Returns an empty note (not 404) for unknown keys so the page can render
    its 'More on this piece soon' fallback uniformly."""
    pieces = _load()
    entry = pieces.get(key, {})
    return {
        "key": key,
        "note": entry.get("note", ""),
        "updated_at": entry.get("updated_at"),
    }


@router.put("/{key}", response_model=dict)
def upsert_piece(key: str, body: StudioPieceUpdate):
    """Create-or-update the note for a piece. Auth required."""
    if body.note is None:
        raise HTTPException(status_code=400, detail="note is required")
    pieces = _load()
    pieces[key] = {
        "note": body.note,
        "updated_at": _now(),
    }
    _save(pieces)
    return {"key": key, "note": pieces[key]["note"], "updated_at": pieces[key]["updated_at"]}
