"""
Visual Assets API — Living spec sheet + system of record for every brand
and site asset (shipped + planned + parked).

Three lifecycle states power the UX:
  - uncommitted: spec exists, nobody's committed to producing it
  - in_progress: kiran has committed and is producing (or designer is)
  - shipped: file exists on disk, asset is live
  - parked: deferred / explicitly de-prioritized

This is the source of truth that replaces the static HTML inventory.
Stored as a flat JSON file. No external dependencies.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query

from utils.config import data_dir
from models.visual_assets import (
    VisualAssetCreate,
    VisualAssetUpdate,
    VALID_STATUSES,
    VALID_CATEGORIES,
    VALID_OWNERS,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

ITEMS_FILE = os.path.join(data_dir("visual_assets"), "items.json")

# Seed file shipped with the repo (populated by scripts/seed_visual_assets.py)
_SEED_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "visual_assets", "items.json"
)


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(ITEMS_FILE):
        with open(ITEMS_FILE) as f:
            return json.load(f)
    if os.path.exists(_SEED_FILE):
        with open(_SEED_FILE) as f:
            data = json.load(f)
        _save(data)
        return data
    return []


def _save(data: list):
    os.makedirs(os.path.dirname(ITEMS_FILE), exist_ok=True)
    with open(ITEMS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_enums(asset: dict):
    """Raise 400 if any enum field has an invalid value."""
    if asset.get("status") and asset["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {VALID_STATUSES}")
    if asset.get("category") and asset["category"] not in VALID_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {VALID_CATEGORIES}")
    if asset.get("owner") and asset["owner"] not in VALID_OWNERS:
        raise HTTPException(400, f"Invalid owner. Must be one of: {VALID_OWNERS}")


# ── List & Filter ─────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_assets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    owner: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
):
    """List visual assets, filterable by status / category / owner / search.
    Default page size is large because the inventory is the whole point —
    UI groups by category client-side.
    """
    assets = _load()

    if status:
        assets = [a for a in assets if a.get("status") == status]
    if category:
        assets = [a for a in assets if a.get("category") == category]
    if owner:
        assets = [a for a in assets if a.get("owner") == owner]
    if search:
        q = search.lower()
        assets = [
            a for a in assets
            if q in (a.get("name") or "").lower()
            or q in (a.get("purpose") or "").lower()
            or q in (a.get("notes") or "").lower()
        ]

    # Sort: shipped last, in_progress first, then uncommitted, then parked.
    # Within bucket, alphabetize by name.
    status_order = {"in_progress": 0, "uncommitted": 1, "shipped": 2, "parked": 3}
    assets.sort(key=lambda a: (
        status_order.get(a.get("status", "uncommitted"), 1),
        (a.get("name") or "").lower(),
    ))

    total = len(assets)
    assets = assets[offset:offset + limit]

    return {"assets": assets, "total": total, "offset": offset, "limit": limit}


@router.get("/summary", response_model=dict)
def get_summary():
    """Counts by status and category for dashboard headers."""
    assets = _load()

    by_status = {s: 0 for s in VALID_STATUSES}
    by_category = {c: 0 for c in VALID_CATEGORIES}
    by_owner = {o: 0 for o in VALID_OWNERS}

    for a in assets:
        s = a.get("status", "uncommitted")
        c = a.get("category", "")
        o = a.get("owner", "tbd")
        by_status[s] = by_status.get(s, 0) + 1
        if c:
            by_category[c] = by_category.get(c, 0) + 1
        by_owner[o] = by_owner.get(o, 0) + 1

    return {
        "total": len(assets),
        "by_status": by_status,
        "by_category": by_category,
        "by_owner": by_owner,
    }


@router.get("/categories", response_model=dict)
def list_categories():
    """Return all valid categories + counts."""
    assets = _load()
    counts = {c: 0 for c in VALID_CATEGORIES}
    for a in assets:
        c = a.get("category")
        if c:
            counts[c] = counts.get(c, 0) + 1
    return {"categories": VALID_CATEGORIES, "counts": counts}


@router.get("/{asset_id}", response_model=dict)
def get_asset(asset_id: str):
    """Get a single asset by id."""
    assets = _load()
    for a in assets:
        if a.get("id") == asset_id:
            return a
    raise HTTPException(404, "Asset not found")


# ── Create / Update / Delete ───────────────────────────────────────

@router.post("/", response_model=dict)
def create_asset(body: VisualAssetCreate):
    """Create a new visual asset spec."""
    asset = body.model_dump()
    _validate_enums(asset)

    asset["id"] = str(uuid.uuid4())
    asset["created_at"] = _now()
    asset["updated_at"] = _now()
    asset["shipped_at"] = _now() if asset.get("status") == "shipped" else None

    assets = _load()
    assets.append(asset)
    _save(assets)
    return asset


@router.patch("/{asset_id}", response_model=dict)
def update_asset(asset_id: str, body: VisualAssetUpdate):
    """Partial update — only changed fields are sent."""
    assets = _load()
    for asset in assets:
        if asset.get("id") == asset_id:
            updates = body.model_dump(exclude_none=True)
            # Validate any enum changes
            _validate_enums({**asset, **updates})

            # Track shipped_at transitions
            new_status = updates.get("status")
            if new_status == "shipped" and asset.get("status") != "shipped":
                updates["shipped_at"] = _now()
            elif new_status and new_status != "shipped" and asset.get("status") == "shipped":
                # Reverting from shipped — clear shipped_at
                updates["shipped_at"] = None

            for k, v in updates.items():
                asset[k] = v
            asset["updated_at"] = _now()
            _save(assets)
            return asset
    raise HTTPException(404, "Asset not found")


@router.put("/{asset_id}", response_model=dict)
def replace_asset(asset_id: str, body: VisualAssetUpdate):
    """Alias for PATCH — keep PUT working too (frontend can use either)."""
    return update_asset(asset_id, body)


@router.post("/{asset_id}/status", response_model=dict)
def flip_status(asset_id: str, status: str = Query(...)):
    """Flip an asset's lifecycle status. Convenience endpoint for the
    one-click status pill in the UI."""
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {VALID_STATUSES}")

    assets = _load()
    for asset in assets:
        if asset.get("id") == asset_id:
            previous = asset.get("status")
            asset["status"] = status
            asset["updated_at"] = _now()
            if status == "shipped" and previous != "shipped":
                asset["shipped_at"] = _now()
            elif status != "shipped" and previous == "shipped":
                asset["shipped_at"] = None
            _save(assets)
            return asset
    raise HTTPException(404, "Asset not found")


@router.delete("/{asset_id}", response_model=dict)
def delete_asset(asset_id: str):
    """Delete an asset spec."""
    assets = _load()
    filtered = [a for a in assets if a.get("id") != asset_id]
    if len(filtered) == len(assets):
        raise HTTPException(404, "Asset not found")
    _save(filtered)
    return {"deleted": asset_id}


# ── Filesystem detection ──────────────────────────────────────────

@router.post("/detect-shipped", response_model=dict)
def detect_shipped():
    """Walk every asset's output_path; if the file exists on disk and the
    asset isn't already shipped, flip it. Returns the list of changed assets.

    Lets the UI re-sync after Kiran drops new MJ outputs into images/."""
    # Site repo root: backend/ -> command-center/ -> site repo
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    site_root = os.path.dirname(os.path.dirname(backend_dir))

    assets = _load()
    flipped = []
    for asset in assets:
        path = asset.get("output_path")
        if not path:
            continue
        # output_path is stored as a site-relative path like "images/og/og-blog.png"
        # or "images/favicon/favicon.svg". Normalize.
        rel = path.lstrip("/")
        full = os.path.join(site_root, rel)
        if os.path.exists(full) and asset.get("status") != "shipped":
            asset["status"] = "shipped"
            asset["shipped_at"] = _now()
            asset["updated_at"] = _now()
            flipped.append({"id": asset["id"], "name": asset.get("name"), "path": rel})

    if flipped:
        _save(assets)

    return {"flipped": flipped, "checked": len(assets), "site_root": site_root}


# ── Action item linking ────────────────────────────────────────────

@router.post("/{asset_id}/link-action-item", response_model=dict)
def link_action_item(asset_id: str, action_item_id: str = Query(...)):
    """Add an action item reference to an asset."""
    assets = _load()
    for asset in assets:
        if asset.get("id") == asset_id:
            linked = asset.get("linked_action_items") or []
            if action_item_id not in linked:
                linked.append(action_item_id)
            asset["linked_action_items"] = linked
            asset["updated_at"] = _now()
            _save(assets)
            return asset
    raise HTTPException(404, "Asset not found")


@router.delete("/{asset_id}/link-action-item/{action_item_id}", response_model=dict)
def unlink_action_item(asset_id: str, action_item_id: str):
    """Remove an action item reference from an asset."""
    assets = _load()
    for asset in assets:
        if asset.get("id") == asset_id:
            linked = asset.get("linked_action_items") or []
            asset["linked_action_items"] = [x for x in linked if x != action_item_id]
            asset["updated_at"] = _now()
            _save(assets)
            return asset
    raise HTTPException(404, "Asset not found")


# ── Enum reference (for frontend dropdowns) ────────────────────────

@router.get("/meta/enums", response_model=dict)
def get_enums():
    """Return enum values the frontend uses to build dropdowns."""
    return {
        "statuses": VALID_STATUSES,
        "categories": VALID_CATEGORIES,
        "owners": VALID_OWNERS,
    }
