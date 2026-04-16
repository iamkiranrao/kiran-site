"""
Career Initiatives API — Structured career initiative cards as a first-class entity.

Replaces flat career-data.json with a proper CRUD API following the same
architectural patterns as action_items. Each initiative captures the four-beat
narrative (problem, bet, shipped, outcome), metrics, domain tags, and company
metadata. Queryable by Fenix for domain-specific career questions.

Stored as a flat JSON file. No external dependencies.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query

from utils.config import data_dir
from models.career_initiatives import (
    InitiativeCreate,
    InitiativeUpdate,
    VALID_DOMAINS,
    VALID_COMPANIES,
    VALID_ERAS,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter()

INITIATIVES_FILE = os.path.join(data_dir("career_initiatives"), "initiatives.json")

# Seed file shipped with the repo
_SEED_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "career_initiatives", "initiatives.json"
)


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(INITIATIVES_FILE):
        with open(INITIATIVES_FILE) as f:
            return json.load(f)
    # Try seed file on first run
    if os.path.exists(_SEED_FILE):
        with open(_SEED_FILE) as f:
            data = json.load(f)
        _save(data)
        return data
    return []


def _save(data: list):
    os.makedirs(os.path.dirname(INITIATIVES_FILE), exist_ok=True)
    with open(INITIATIVES_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/domains", response_model=dict)
def list_domains():
    """Return domains with initiative counts."""
    initiatives = _load()
    public_initiatives = [i for i in initiatives if i.get("public", True)]
    domain_counts = {}
    for init in public_initiatives:
        for domain in init.get("domains", []):
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
    return {
        "domains": [
            {"domain": d, "count": c}
            for d, c in sorted(domain_counts.items(), key=lambda x: -x[1])
        ],
        "valid_domains": VALID_DOMAINS,
    }


@router.get("/companies", response_model=dict)
def list_companies():
    """Return companies with initiative counts."""
    initiatives = _load()
    public_initiatives = [i for i in initiatives if i.get("public", True)]
    company_counts = {}
    for init in public_initiatives:
        company = init.get("company", "")
        if company:
            company_counts[company] = company_counts.get(company, 0) + 1
    return {
        "companies": [
            {"company": c, "count": ct}
            for c, ct in sorted(company_counts.items(), key=lambda x: -x[1])
        ],
        "valid_companies": VALID_COMPANIES,
    }


@router.get("/domain/{domain}", response_model=dict)
def get_by_domain(domain: str):
    """Get all public initiatives for a specific domain."""
    initiatives = _load()
    matched = [
        i for i in initiatives
        if domain in i.get("domains", []) and i.get("public", True)
    ]
    return {"initiatives": matched, "total": len(matched), "domain": domain}


@router.get("/", response_model=dict)
def list_initiatives(
    domain: Optional[str] = None,
    company: Optional[str] = None,
    era: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    public_only: bool = False,
    fenix_only: bool = False,
    limit: int = 50,
    offset: int = 0,
):
    """List initiatives with optional filters."""
    initiatives = _load()

    if public_only:
        initiatives = [i for i in initiatives if i.get("public", True)]
    if fenix_only:
        initiatives = [i for i in initiatives if i.get("fenix_indexed", True)]
    if domain:
        initiatives = [i for i in initiatives if domain in i.get("domains", [])]
    if company:
        initiatives = [i for i in initiatives if i.get("company") == company]
    if era:
        initiatives = [i for i in initiatives if i.get("era") == era]
    if tag:
        initiatives = [i for i in initiatives if tag in i.get("tags", [])]
    if search:
        q = search.lower()
        initiatives = [
            i for i in initiatives
            if q in i.get("title", "").lower()
            or q in i.get("one_liner", "").lower()
            or q in i.get("problem", "").lower()
            or q in i.get("bet", "").lower()
            or q in i.get("shipped", "").lower()
            or q in i.get("outcome", "").lower()
        ]

    # Sort by year_start descending (most recent first), then title
    initiatives.sort(key=lambda i: (
        -(i.get("year_start") or 0),
        i.get("title", ""),
    ))

    total = len(initiatives)
    initiatives = initiatives[offset:offset + limit]

    return {"initiatives": initiatives, "total": total, "offset": offset, "limit": limit}


@router.post("/", response_model=dict)
def create_initiative(body: InitiativeCreate):
    """Create a new career initiative."""
    initiatives = _load()
    now = datetime.now(timezone.utc).isoformat()
    initiative = {
        "id": str(uuid.uuid4())[:8],
        "title": body.title,
        "one_liner": body.one_liner,
        "company": body.company,
        "role": body.role,
        "era": body.era,
        "year_start": body.year_start,
        "year_end": body.year_end,
        "domains": body.domains,
        "tags": body.tags,
        "problem": body.problem,
        "bet": body.bet,
        "shipped": body.shipped,
        "outcome": body.outcome,
        "headline_metric_number": body.headline_metric_number,
        "headline_metric_label": body.headline_metric_label,
        "outcome_metrics": body.outcome_metrics,
        "gallery_items": body.gallery_items,
        "public": body.public,
        "fenix_indexed": body.fenix_indexed,
        "closed_gap_id": body.closed_gap_id,
        "requirement_coverage": body.requirement_coverage,
        "notes": "",
        "created_at": now,
        "updated_at": now,
    }
    initiatives.append(initiative)
    _save(initiatives)

    # If this initiative closes a gap, update the gap's closed_by_initiative_id
    if body.closed_gap_id:
        try:
            from services.gap_discovery_service import link_gap_to_initiative
            link_gap_to_initiative(body.closed_gap_id, initiative["id"])
        except Exception as e:
            logger.warning(f"Failed to link gap {body.closed_gap_id} to new initiative: {e}")

    return initiative


@router.post("/bulk", response_model=dict)
def create_initiatives_bulk(initiatives_data: List[InitiativeCreate]):
    """Create multiple initiatives at once (for migration/backfill)."""
    initiatives = _load()
    created = []
    now = datetime.now(timezone.utc).isoformat()
    for body in initiatives_data:
        initiative = {
            "id": str(uuid.uuid4())[:8],
            "title": body.title,
            "one_liner": body.one_liner,
            "company": body.company,
            "role": body.role,
            "era": body.era,
            "year_start": body.year_start,
            "year_end": body.year_end,
            "domains": body.domains,
            "tags": body.tags,
            "problem": body.problem,
            "bet": body.bet,
            "shipped": body.shipped,
            "outcome": body.outcome,
            "headline_metric_number": body.headline_metric_number,
            "headline_metric_label": body.headline_metric_label,
            "outcome_metrics": body.outcome_metrics,
            "gallery_items": body.gallery_items,
            "public": body.public,
            "fenix_indexed": body.fenix_indexed,
            "closed_gap_id": body.closed_gap_id,
            "requirement_coverage": body.requirement_coverage,
            "notes": "",
            "created_at": now,
            "updated_at": now,
        }
        initiatives.append(initiative)
        created.append(initiative)
    _save(initiatives)
    return {"created": len(created), "initiatives": created}


@router.get("/{initiative_id}", response_model=dict)
def get_initiative(initiative_id: str):
    """Get a single initiative by ID."""
    initiatives = _load()
    for init in initiatives:
        if init["id"] == initiative_id:
            return init
    raise HTTPException(status_code=404, detail="Initiative not found")


@router.put("/{initiative_id}", response_model=dict)
def update_initiative(initiative_id: str, body: InitiativeUpdate):
    """Update an existing initiative."""
    initiatives = _load()
    for init in initiatives:
        if init["id"] == initiative_id:
            for field, value in body.model_dump(exclude_none=True).items():
                init[field] = value
            init["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save(initiatives)
            return init
    raise HTTPException(status_code=404, detail="Initiative not found")


@router.delete("/{initiative_id}", response_model=dict)
def delete_initiative(initiative_id: str):
    """Delete an initiative."""
    initiatives = _load()
    filtered = [i for i in initiatives if i["id"] != initiative_id]
    if len(filtered) == len(initiatives):
        raise HTTPException(status_code=404, detail="Initiative not found")
    _save(filtered)
    return {"deleted": initiative_id}
