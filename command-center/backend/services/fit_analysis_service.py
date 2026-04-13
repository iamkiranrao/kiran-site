"""
Fit Analysis Service — persistence for fit narrative results.

Stores completed fit analyses in Supabase so they can be retrieved
by ID for URL-based refresh and sharing.

Tables used:
  - fit_analyses: id, payload, jd_hash, created_at
"""

import hashlib
import logging
import os
import secrets
import string
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client
from utils.exceptions import NotFoundError

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


def _generate_id() -> str:
    """Generate a short, URL-safe analysis ID like 'fn_k8m2x9p4'."""
    chars = string.ascii_lowercase + string.digits
    suffix = ''.join(secrets.choice(chars) for _ in range(8))
    return f"fn_{suffix}"


def _hash_jd(jd_text: str) -> str:
    """SHA-256 hash of JD text for deduplication."""
    return hashlib.sha256(jd_text.strip().encode()).hexdigest()[:16]


# ── Fit Analyses ─────────────────────────────────────────────────


def save_analysis(payload: dict, jd_text: str) -> str:
    """
    Save a completed fit analysis. Returns the analysis ID.

    payload should contain: company, role_title, preferred_company,
    verdict, primary_matches, added_value, cutting_floor, key_takeaway
    """
    sb = _get_client()
    analysis_id = _generate_id()
    jd_hash = _hash_jd(jd_text)

    row = {
        "id": analysis_id,
        "payload": payload,
        "jd_hash": jd_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        sb.table("fit_analyses").insert(row).execute()
        logger.info("Saved fit analysis: %s", analysis_id)
    except Exception as e:
        logger.error("Failed to save fit analysis: %s", e)
        raise

    return analysis_id


def get_analysis(analysis_id: str) -> dict:
    """Retrieve a stored fit analysis by ID."""
    sb = _get_client()

    try:
        result = sb.table("fit_analyses").select("*").eq("id", analysis_id).execute()
    except Exception as e:
        logger.error("Failed to retrieve fit analysis: %s", e)
        raise

    if not result.data:
        raise NotFoundError(f"Analysis '{analysis_id}' not found")

    row = result.data[0]
    return {
        "id": row["id"],
        "payload": row["payload"],
        "created_at": row["created_at"],
    }


def list_analyses(limit: int = 50, offset: int = 0) -> dict:
    """Paginated list of fit analyses."""
    sb = _get_client()

    try:
        result = (
            sb.table("fit_analyses")
            .select("id, payload, created_at", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as e:
        logger.error("Failed to list fit analyses: %s", e)
        raise

    return {
        "analyses": result.data,
        "total": result.count or 0,
        "offset": offset,
        "limit": limit,
    }


def delete_analysis(analysis_id: str) -> dict:
    """Delete a single fit analysis."""
    sb = _get_client()

    try:
        sb.table("fit_analyses").delete().eq("id", analysis_id).execute()
        logger.info("Deleted fit analysis: %s", analysis_id)
    except Exception as e:
        logger.error("Failed to delete fit analysis: %s", e)
        raise

    return {"success": True}
