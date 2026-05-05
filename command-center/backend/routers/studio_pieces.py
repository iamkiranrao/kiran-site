"""Studio Pieces API.

Editable text attributes (title, date, tools, style, inspiredBy, dimensions,
note) for the Studio Illustration page. The catalog of pieces lives in
studio-illustration.html (data-key attributes); this service stores per-piece
overrides for the lightbox text fields. The page merges CC values over inline
HTML at render time — CC wins when a field is non-empty.

Auth model:
- GET  /api/studio-pieces/         — list all (auth required, admin UI)
- GET  /api/studio-pieces/{key}    — read one (PUBLIC — the site fetches this)
- PUT  /api/studio-pieces/{key}    — upsert subset of fields (auth required)

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

# Fields that are part of the editable text record. Order is the natural
# reading order in the lightbox metadata panel.
EDITABLE_FIELDS = ("title", "date", "tools", "style", "inspiredBy", "dimensions", "note")


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> dict:
    """Return {key: {<fields>, updated_at}} dict. Empty if file doesn't exist."""
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


def _format(key: str, entry: dict) -> dict:
    """Normalize a stored entry into the API response shape. Missing fields
    default to empty strings so the page can do simple truthy checks."""
    out = {"key": key}
    for f in EDITABLE_FIELDS:
        out[f] = entry.get(f, "") or ""
    out["updated_at"] = entry.get("updated_at")
    return out


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_pieces():
    """List every stored record. Auth required (admin UI calls this)."""
    pieces = _load()
    items = [_format(k, v) for k, v in pieces.items()]
    items.sort(key=lambda p: p["key"])
    return {"pieces": items, "total": len(items)}


@router.get("/{key}", response_model=dict)
def get_piece(key: str):
    """Read one piece's overrides. PUBLIC endpoint — the studio page calls
    this on lightbox open. Returns all-empty fields (not 404) for unknown
    keys so the page can render its inline-HTML fallback uniformly."""
    pieces = _load()
    return _format(key, pieces.get(key, {}))


@router.put("/{key}", response_model=dict)
def upsert_piece(key: str, body: StudioPieceUpdate):
    """Create-or-update text overrides for a piece. Auth required.

    Only fields explicitly sent in the body are touched. Fields you don't
    send are preserved. Send an empty string to explicitly clear a field
    (which restores the inline HTML value as the source of truth)."""
    update_dict = body.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields provided")

    pieces = _load()
    existing = pieces.get(key, {})
    existing.update(update_dict)
    existing["updated_at"] = _now()
    pieces[key] = existing
    _save(pieces)
    return _format(key, pieces[key])
