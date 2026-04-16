"""
Target Companies API — Manage Kiran's target company list.

Stored as a flat JSON file. Simple CRUD.
Used by Gap Discovery for the company dropdown and as a standalone visible list.
Includes role browsing — surface real PM roles for Kiran to hand-pick.
"""

import json
import os
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from utils.config import data_dir

router = APIRouter()

COMPANIES_FILE = os.path.join(data_dir("target_companies"), "companies.json")

_SEED_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "target_companies", "companies.json"
)


class TargetCompany(BaseModel):
    name: str = Field(..., description="Company name")
    tier: str = Field("target", description="dream | target | consulting | stretch")
    domain: str = Field("", description="ai | big-tech | consumer | fintech | saas | commerce | consulting")
    notes: str = Field("", description="Brief notes about the company")


class TargetCompanyUpdate(BaseModel):
    tier: Optional[str] = None
    domain: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────

def _load() -> list:
    if os.path.exists(COMPANIES_FILE):
        with open(COMPANIES_FILE) as f:
            return json.load(f)
    if os.path.exists(_SEED_FILE):
        with open(_SEED_FILE) as f:
            data = json.load(f)
        _save(data)
        return data
    return []


def _save(data: list):
    os.makedirs(os.path.dirname(COMPANIES_FILE), exist_ok=True)
    with open(COMPANIES_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/", response_model=dict)
def list_companies(
    tier: Optional[str] = None,
    domain: Optional[str] = None,
):
    """List all target companies with optional tier/domain filters."""
    companies = _load()
    if tier:
        companies = [c for c in companies if c.get("tier") == tier]
    if domain:
        companies = [c for c in companies if c.get("domain") == domain]

    # Group by tier for summary
    tiers = {}
    for c in _load():
        t = c.get("tier", "target")
        tiers[t] = tiers.get(t, 0) + 1

    return {
        "companies": companies,
        "total": len(companies),
        "by_tier": tiers,
    }


@router.post("/", response_model=dict)
def add_company(body: TargetCompany):
    """Add a new target company."""
    companies = _load()
    # Deduplicate by name
    if any(c["name"].lower() == body.name.lower() for c in companies):
        raise HTTPException(409, f"Company '{body.name}' already exists")
    companies.append(body.model_dump())
    _save(companies)
    return {"added": body.name, "total": len(companies)}


@router.put("/{company_name}", response_model=dict)
def update_company(company_name: str, body: TargetCompanyUpdate):
    """Update a target company's tier, domain, or notes."""
    companies = _load()
    for c in companies:
        if c["name"].lower() == company_name.lower():
            for field, value in body.model_dump(exclude_none=True).items():
                c[field] = value
            _save(companies)
            return c
    raise HTTPException(404, f"Company '{company_name}' not found")


@router.delete("/{company_name}", response_model=dict)
def remove_company(company_name: str):
    """Remove a target company."""
    companies = _load()
    filtered = [c for c in companies if c["name"].lower() != company_name.lower()]
    if len(filtered) == len(companies):
        raise HTTPException(404, f"Company '{company_name}' not found")
    _save(filtered)
    return {"removed": company_name, "remaining": len(filtered)}



# ── Pipeline Reset ─────────────────────────────────────────────


@router.post("/pipeline/reset", response_model=dict)
async def reset_jd_pipeline(
    mode: str = Query("nuclear", description="'nuclear' = wipe everything, 'jd-only' = only JD-sourced gaps"),
):
    """Full pipeline reset — clean slate across all gap-discovery workflows.

    mode=nuclear (default): Wipes ALL gap items, reports, closure plans, moves,
    role cache, and gap-sourced evidence embeddings. Target companies are preserved.

    mode=jd-only: Only removes JD-sourced gaps, preserves manual/aspirational gaps.
    """
    import shutil

    results: dict = {}

    try:
        from services.evidence_service import _get_client
        sb = _get_client()

        # ── 1. Gap Items (Supabase) ─────────────────────────────
        if mode == "nuclear":
            all_resp = sb.table("evidence_gap_items").select("id", count="exact").execute()
            total_gaps = all_resp.count if hasattr(all_resp, "count") and all_resp.count is not None else len(all_resp.data)

            if total_gaps > 0:
                # Supabase delete needs a filter — use a tautology
                sb.table("evidence_gap_items").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

            results["gaps_removed"] = total_gaps
            results["manual_gaps_preserved"] = 0
        else:
            count_resp = sb.table("evidence_gap_items").select("id", count="exact").neq("source_jd_company", None).execute()
            jd_gap_count = count_resp.count if hasattr(count_resp, "count") and count_resp.count is not None else len(count_resp.data)
            manual_resp = sb.table("evidence_gap_items").select("id", count="exact").is_("source_jd_company", "null").execute()
            manual_count = manual_resp.count if hasattr(manual_resp, "count") and manual_resp.count is not None else len(manual_resp.data)

            if jd_gap_count > 0:
                sb.table("evidence_gap_items").delete().neq("source_jd_company", None).execute()

            results["gaps_removed"] = jd_gap_count
            results["manual_gaps_preserved"] = manual_count

        # ── 2. Gap Discovery Reports (JSON files) ───────────────
        reports_dir = data_dir("gap_discovery_reports")
        if os.path.exists(reports_dir):
            results["reports_cleared"] = len([f for f in os.listdir(reports_dir) if f.endswith(".json")])
            shutil.rmtree(reports_dir)
            os.makedirs(reports_dir)
        else:
            results["reports_cleared"] = 0

        # ── 3. Closure Plans (JSON files) ───────────────────────
        plans_dir = data_dir("gap_closure_plans")
        if os.path.exists(plans_dir):
            results["closure_plans_cleared"] = len([f for f in os.listdir(plans_dir) if f.endswith(".json")])
            shutil.rmtree(plans_dir)
            os.makedirs(plans_dir)
        else:
            results["closure_plans_cleared"] = 0

        # ── 4. Gap Closure Moves (JSON files) ───────────────────
        moves_dir = data_dir("gap_closure_moves")
        if os.path.exists(moves_dir):
            results["moves_cleared"] = len([f for f in os.listdir(moves_dir) if f.endswith(".json")])
            shutil.rmtree(moves_dir)
            os.makedirs(moves_dir)
        else:
            results["moves_cleared"] = 0

        # ── 5. Role Search Cache (JSON files) ──────────────────
        cache_dir = data_dir("role_search_cache")
        if os.path.exists(cache_dir):
            results["role_cache_cleared"] = len([f for f in os.listdir(cache_dir) if f.endswith(".json")])
            shutil.rmtree(cache_dir)
            os.makedirs(cache_dir)
        else:
            results["role_cache_cleared"] = 0

        # ── 6. Evidence Embeddings from gap work (Supabase) ────
        try:
            embed_resp = sb.table("content_embeddings").select("id", count="exact").eq("source_type", "evidence_vault").execute()
            embed_count = embed_resp.count if hasattr(embed_resp, "count") and embed_resp.count is not None else len(embed_resp.data)
            if embed_count > 0:
                sb.table("content_embeddings").delete().eq("source_type", "evidence_vault").execute()
            reg_resp = sb.table("content_registry").select("id", count="exact").eq("source_type", "evidence_vault").execute()
            reg_count = reg_resp.count if hasattr(reg_resp, "count") and reg_resp.count is not None else len(reg_resp.data)
            if reg_count > 0:
                sb.table("content_registry").delete().eq("source_type", "evidence_vault").execute()
            results["embeddings_cleared"] = embed_count
            results["registry_entries_cleared"] = reg_count
        except Exception:
            results["embeddings_cleared"] = 0
            results["registry_entries_cleared"] = 0

        results["status"] = "reset_complete"
        results["mode"] = mode
        results["message"] = (
            f"Full pipeline reset complete. "
            f"{results['gaps_removed']} gaps, {results['reports_cleared']} reports, "
            f"{results['closure_plans_cleared']} plans, {results['moves_cleared']} moves, "
            f"{results['role_cache_cleared']} role caches cleared. "
            f"Ready to rebuild from hand-picked roles."
        )

        return results

    except Exception as e:
        raise HTTPException(500, f"Pipeline reset failed: {str(e)}")
