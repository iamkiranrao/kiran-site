"""
Evidence Management Service — CRUD operations for skills evidence data.

Tables used:
  - evidence_domains: skill domains (Product, AI & ML, etc.)
  - evidence_skills: individual skills within domains
  - evidence_sources: evidence items (certs, prototypes, projects, teardowns)
  - evidence_skill_links: many-to-many skill-to-source mappings
  - evidence_cert_details: extended cert modal data
  - evidence_item_details: extended prototype/project/teardown modal data
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional, List

from supabase import create_client, Client

logger = logging.getLogger(__name__)


def _get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ── Domains ──────────────────────────────────────────────────


def list_domains() -> dict:
    sb = _get_client()
    result = sb.table("evidence_domains").select("*").order("sort_order").execute()
    return {"entries": result.data, "total": len(result.data)}


def create_domain(id: str, label: str, color: str, sort_order: int) -> dict:
    sb = _get_client()
    row = {"id": id, "label": label, "color": color, "sort_order": sort_order}
    result = sb.table("evidence_domains").insert(row).execute()
    return {"success": True, "id": id, "message": f"Domain '{label}' created"}


def update_domain(domain_id: str, updates: dict) -> dict:
    sb = _get_client()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_domains").update(updates).eq("id", domain_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Domain '{domain_id}' not found")
    return {"success": True, "updated": result.data[0]}


def delete_domain(domain_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_domains").delete().eq("id", domain_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Domain '{domain_id}' not found")
    return {"deleted": True, "id": domain_id}


# ── Skills ───────────────────────────────────────────────────


def list_skills(domain_id: Optional[str] = None) -> dict:
    sb = _get_client()
    query = sb.table("evidence_skills").select("*")
    if domain_id:
        query = query.eq("domain_id", domain_id)
    result = query.order("domain_id").order("sort_order").execute()
    return {"entries": result.data, "total": len(result.data)}


def create_skill(id: str, label: str, domain_id: str, sort_order: int) -> dict:
    sb = _get_client()
    row = {"id": id, "label": label, "domain_id": domain_id, "sort_order": sort_order}
    result = sb.table("evidence_skills").insert(row).execute()
    return {"success": True, "id": id, "message": f"Skill '{label}' created"}


def update_skill(skill_id: str, updates: dict) -> dict:
    sb = _get_client()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_skills").update(updates).eq("id", skill_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Skill '{skill_id}' not found")
    return {"success": True, "updated": result.data[0]}


def delete_skill(skill_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_skills").delete().eq("id", skill_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Skill '{skill_id}' not found")
    return {"deleted": True, "id": skill_id}


# ── Sources ──────────────────────────────────────────────────


def list_sources(
    type_filter: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    sb = _get_client()
    query = sb.table("evidence_sources").select("*")
    if not include_archived:
        query = query.eq("archived", False)
    if type_filter:
        query = query.eq("type", type_filter)
    if search:
        query = query.ilike("label", f"%{search}%")
    result = query.order("type").order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"entries": result.data, "total": len(result.data), "offset": offset, "limit": limit}


def get_source(source_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_sources").select("*").eq("id", source_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Source '{source_id}' not found")
    return result.data[0]


def create_source(id: str, label: str, type: str, issuer: Optional[str] = None,
                  year: Optional[int] = None, url: Optional[str] = None) -> dict:
    sb = _get_client()
    row = {"id": id, "label": label, "type": type, "issuer": issuer, "year": year, "url": url}
    result = sb.table("evidence_sources").insert(row).execute()
    return {"success": True, "id": id, "message": f"Source '{label}' created"}


def update_source(source_id: str, updates: dict) -> dict:
    sb = _get_client()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_sources").update(updates).eq("id", source_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Source '{source_id}' not found")
    return {"success": True, "updated": result.data[0]}


def archive_source(source_id: str) -> dict:
    """Soft-delete a source by marking it archived."""
    return update_source(source_id, {"archived": True})


def delete_source(source_id: str) -> dict:
    """Hard delete a source (cascades to links and details)."""
    sb = _get_client()
    result = sb.table("evidence_sources").delete().eq("id", source_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Source '{source_id}' not found")
    return {"deleted": True, "id": source_id}


# ── Skill Links ──────────────────────────────────────────────


def list_links(
    source_id: Optional[str] = None,
    skill_id: Optional[str] = None,
) -> dict:
    sb = _get_client()
    query = sb.table("evidence_skill_links").select("*")
    if source_id:
        query = query.eq("source_id", source_id)
    if skill_id:
        query = query.eq("skill_id", skill_id)
    result = query.order("source_id").execute()
    return {"entries": result.data, "total": len(result.data)}


def create_link(source_id: str, skill_id: str) -> dict:
    sb = _get_client()
    row = {"source_id": source_id, "skill_id": skill_id}
    result = sb.table("evidence_skill_links").insert(row).execute()
    link_id = result.data[0]["id"] if result.data else None
    return {"success": True, "id": link_id, "message": f"Link {source_id} -> {skill_id} created"}


def bulk_create_links(source_id: str, skill_ids: List[str]) -> dict:
    """Create multiple links for a source at once. Skips duplicates."""
    sb = _get_client()
    rows = [{"source_id": source_id, "skill_id": sid} for sid in skill_ids]
    # Upsert to skip duplicates
    result = sb.table("evidence_skill_links").upsert(
        rows, on_conflict="source_id,skill_id"
    ).execute()
    return {"success": True, "created": len(result.data), "source_id": source_id}


def delete_link(link_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_skill_links").delete().eq("id", link_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Link '{link_id}' not found")
    return {"deleted": True, "id": link_id}


def replace_links_for_source(source_id: str, skill_ids: List[str]) -> dict:
    """Replace all skill links for a source with a new set."""
    sb = _get_client()
    # Delete existing
    sb.table("evidence_skill_links").delete().eq("source_id", source_id).execute()
    # Insert new
    if skill_ids:
        rows = [{"source_id": source_id, "skill_id": sid} for sid in skill_ids]
        sb.table("evidence_skill_links").insert(rows).execute()
    return {"success": True, "source_id": source_id, "skill_count": len(skill_ids)}


# ── Cert Details ─────────────────────────────────────────────


def get_cert_detail(source_id: str) -> Optional[dict]:
    sb = _get_client()
    result = sb.table("evidence_cert_details").select("*").eq("source_id", source_id).execute()
    return result.data[0] if result.data else None


def upsert_cert_detail(data: dict) -> dict:
    sb = _get_client()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_cert_details").upsert(data, on_conflict="source_id").execute()
    return {"success": True, "source_id": data["source_id"], "message": "Cert detail saved"}


def delete_cert_detail(source_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_cert_details").delete().eq("source_id", source_id).execute()
    return {"deleted": True, "source_id": source_id}


# ── Evidence Item Details ────────────────────────────────────


def get_item_detail(source_id: str) -> Optional[dict]:
    sb = _get_client()
    result = sb.table("evidence_item_details").select("*").eq("source_id", source_id).execute()
    return result.data[0] if result.data else None


def upsert_item_detail(data: dict) -> dict:
    sb = _get_client()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_item_details").upsert(data, on_conflict="source_id").execute()
    return {"success": True, "source_id": data["source_id"], "message": "Item detail saved"}


def delete_item_detail(source_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_item_details").delete().eq("source_id", source_id).execute()
    return {"deleted": True, "source_id": source_id}


# ── Publish Manifest ─────────────────────────────────────────


def generate_manifest() -> dict:
    """
    Generate the full evidence manifest matching skills.html data shape.
    Returns the JSON object ready to be written to a file or served.
    """
    sb = _get_client()

    # Fetch all data
    domains = sb.table("evidence_domains").select("*").order("sort_order").execute().data
    skills = sb.table("evidence_skills").select("*").order("domain_id").order("sort_order").execute().data
    sources = sb.table("evidence_sources").select("*").eq("archived", False).order("type").execute().data
    links = sb.table("evidence_skill_links").select("source_id, skill_id").execute().data
    cert_details = sb.table("evidence_cert_details").select("*").execute().data
    item_details = sb.table("evidence_item_details").select("*").execute().data

    # Build SKILLS_DATA.sources
    manifest_sources = []
    for s in sources:
        entry = {"id": s["id"], "label": s["label"], "type": s["type"]}
        if s.get("issuer"):
            entry["issuer"] = s["issuer"]
        if s.get("year"):
            entry["year"] = s["year"]
        if s.get("url"):
            entry["url"] = s["url"]
        manifest_sources.append(entry)

    # Build SKILLS_DATA.links
    manifest_links = [{"skill": l["skill_id"], "source": l["source_id"]} for l in links]

    # Build SKILLS_DATA.domains
    manifest_domains = [{"id": d["id"], "label": d["label"], "color": d["color"]} for d in domains]

    # Build SKILLS_DATA.skills
    manifest_skills = [{"id": s["id"], "label": s["label"], "domain": s["domain_id"]} for s in skills]

    # Build CERT_DETAILS
    manifest_certs = {}
    for c in cert_details:
        manifest_certs[c["source_id"]] = {
            "name": c["name"],
            "issuer": c["issuer_full"],
            "credential": c.get("credential"),
            "logo": c.get("logo"),
            "learned": c.get("learned"),
            "skills": c.get("display_skills", []),
            "capstoneLabel": c.get("capstone_label", "Certification"),
            "capstone": c.get("capstone"),
        }

    # Build EVIDENCE_DETAILS
    manifest_items = {}
    for i in item_details:
        manifest_items[i["source_id"]] = {
            "name": i["name"],
            "type": i["type"],
            "tagline": i.get("tagline"),
            "logo": i.get("logo"),
            "description": i.get("description"),
            "techStack": i.get("tech_stack", []),
            "skills": i.get("display_skills", []),
            "highlight": i.get("highlight"),
            "status": i.get("status"),
        }

    # Evidence type colors
    type_colors = {
        "certification": "#7CADE8",
        "prototype": "#7CE8A3",
        "project": "#E8D67C",
        "teardown": "#E8927C",
    }

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "SKILLS_DATA": {
            "domains": manifest_domains,
            "skills": manifest_skills,
            "sources": manifest_sources,
            "links": manifest_links,
            "typeColors": type_colors,
        },
        "CERT_DETAILS": manifest_certs,
        "EVIDENCE_DETAILS": manifest_items,
    }

    return manifest


def get_stats() -> dict:
    """Summary counts for the dashboard header."""
    sb = _get_client()
    sources = sb.table("evidence_sources").select("type").eq("archived", False).execute().data
    links = sb.table("evidence_skill_links").select("id").execute().data
    skills = sb.table("evidence_skills").select("id").execute().data
    domains = sb.table("evidence_domains").select("id").execute().data

    type_counts = {}
    for s in sources:
        t = s["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "total_sources": len(sources),
        "total_links": len(links),
        "total_skills": len(skills),
        "total_domains": len(domains),
        "by_type": type_counts,
    }


# ── Gap Items ("Mind the Gap") ──────────────────────────────


def list_gap_items(category: Optional[str] = None, status: Optional[str] = None, priority: Optional[str] = None) -> dict:
    sb = _get_client()
    query = sb.table("evidence_gap_items").select("*").order("sort_order")
    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("current_status", status)
    if priority:
        query = query.eq("priority", priority)
    result = query.execute()
    return {"entries": result.data, "total": len(result.data)}


def get_gap_item(item_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_gap_items").select("*").eq("id", item_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Gap item '{item_id}' not found")
    return result.data[0]


def create_gap_item(**kwargs) -> dict:
    sb = _get_client()
    result = sb.table("evidence_gap_items").insert(kwargs).execute()
    return result.data[0]


def update_gap_item(item_id: str, **kwargs) -> dict:
    sb = _get_client()
    updates = {k: v for k, v in kwargs.items() if v is not None}
    if not updates:
        return get_gap_item(item_id)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("evidence_gap_items").update(updates).eq("id", item_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Gap item '{item_id}' not found")
    return result.data[0]


def delete_gap_item(item_id: str) -> dict:
    sb = _get_client()
    result = sb.table("evidence_gap_items").delete().eq("id", item_id).execute()
    if not result.data:
        from utils.exceptions import NotFoundError
        raise NotFoundError(f"Gap item '{item_id}' not found")
    return {"deleted": item_id}


def gap_stats() -> dict:
    sb = _get_client()
    result = sb.table("evidence_gap_items").select("category, priority, current_status").execute()
    by_category = {}
    by_priority = {}
    by_status = {}
    for item in result.data:
        cat = item["category"]
        pri = item["priority"]
        sta = item["current_status"]
        by_category[cat] = by_category.get(cat, 0) + 1
        by_priority[pri] = by_priority.get(pri, 0) + 1
        by_status[sta] = by_status.get(sta, 0) + 1
    return {
        "total": len(result.data),
        "by_category": by_category,
        "by_priority": by_priority,
        "by_status": by_status,
    }
