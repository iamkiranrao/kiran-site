"""
Evidence Management Router — CRUD for skills evidence, taxonomy, and
publish-to-site manifest generation.
"""

import json
import os

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from utils.exceptions import NotFoundError, ConflictError

from models.evidence import (
    DomainCreate, DomainUpdate,
    SkillCreate, SkillUpdate,
    SourceCreate, SourceUpdate,
    SkillLinkCreate, SkillLinkBulkCreate,
    CertDetailCreate, CertDetailUpdate,
    ItemDetailCreate, ItemDetailUpdate,
    GapItemCreate, GapItemUpdate,
)
from services.evidence_service import (
    # Domains
    list_domains, create_domain, update_domain, delete_domain,
    # Skills
    list_skills, create_skill, update_skill, delete_skill,
    # Sources
    list_sources, get_source, create_source, update_source,
    archive_source, delete_source,
    # Links
    list_links, create_link, bulk_create_links, delete_link,
    replace_links_for_source,
    # Cert details
    get_cert_detail, upsert_cert_detail, delete_cert_detail,
    # Item details
    get_item_detail, upsert_item_detail, delete_item_detail,
    # Gap items
    list_gap_items, get_gap_item, create_gap_item, update_gap_item,
    delete_gap_item, gap_stats,
    # Manifest
    generate_manifest, get_stats,
)

router = APIRouter()


# ── Stats ────────────────────────────────────────────────────

@router.get("/stats", response_model=dict)
async def evidence_stats():
    """Summary counts for the dashboard header."""
    return get_stats()


# ── Domains ──────────────────────────────────────────────────

@router.get("/domains", response_model=dict)
async def domains_list():
    """List all skill domains."""
    return list_domains()


@router.post("/domains", response_model=dict)
async def domains_create(body: DomainCreate):
    """Create a new skill domain."""
    return create_domain(
        id=body.id, label=body.label,
        color=body.color, sort_order=body.sort_order,
    )


@router.patch("/domains/{domain_id}", response_model=dict)
async def domains_update(domain_id: str, body: DomainUpdate):
    """Update a skill domain."""
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    return update_domain(domain_id, updates)


@router.delete("/domains/{domain_id}", response_model=dict)
async def domains_delete(domain_id: str):
    """Delete a skill domain (cascades to skills)."""
    return delete_domain(domain_id)


# ── Skills ───────────────────────────────────────────────────

@router.get("/skills", response_model=dict)
async def skills_list(domain_id: Optional[str] = Query(None)):
    """List all skills, optionally filtered by domain."""
    return list_skills(domain_id=domain_id)


@router.post("/skills", response_model=dict)
async def skills_create(body: SkillCreate):
    """Create a new skill."""
    return create_skill(
        id=body.id, label=body.label,
        domain_id=body.domain_id, sort_order=body.sort_order,
    )


@router.patch("/skills/{skill_id}", response_model=dict)
async def skills_update(skill_id: str, body: SkillUpdate):
    """Update a skill."""
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    return update_skill(skill_id, updates)


@router.delete("/skills/{skill_id}", response_model=dict)
async def skills_delete(skill_id: str):
    """Delete a skill (cascades to links)."""
    return delete_skill(skill_id)


# ── Sources ──────────────────────────────────────────────────

@router.get("/sources", response_model=dict)
async def sources_list(
    type: Optional[str] = Query(None, description="Filter by type: certification, prototype, project, teardown"),
    search: Optional[str] = Query(None, description="Search by label"),
    include_archived: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List all evidence sources with optional filters."""
    return list_sources(
        type_filter=type, search=search,
        include_archived=include_archived,
        limit=limit, offset=offset,
    )


@router.get("/sources/{source_id}", response_model=dict)
async def sources_get(source_id: str):
    """Get a single evidence source."""
    return get_source(source_id)


@router.post("/sources", response_model=dict)
async def sources_create(body: SourceCreate):
    """Create a new evidence source."""
    return create_source(
        id=body.id, label=body.label, type=body.type,
        issuer=body.issuer, year=body.year, url=body.url,
    )


@router.patch("/sources/{source_id}", response_model=dict)
async def sources_update(source_id: str, body: SourceUpdate):
    """Update an evidence source."""
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    return update_source(source_id, updates)


@router.post("/sources/{source_id}/archive", response_model=dict)
async def sources_archive(source_id: str):
    """Soft-delete an evidence source."""
    return archive_source(source_id)


@router.delete("/sources/{source_id}", response_model=dict)
async def sources_hard_delete(source_id: str):
    """Hard-delete an evidence source (cascades to links and details)."""
    return delete_source(source_id)


# ── Skill Links ──────────────────────────────────────────────

@router.get("/links", response_model=dict)
async def links_list(
    source_id: Optional[str] = Query(None),
    skill_id: Optional[str] = Query(None),
):
    """List skill-to-source mappings with optional filters."""
    return list_links(source_id=source_id, skill_id=skill_id)


@router.post("/links", response_model=dict)
async def links_create(body: SkillLinkCreate):
    """Create a single skill-to-source mapping."""
    return create_link(source_id=body.source_id, skill_id=body.skill_id)


@router.post("/links/bulk", response_model=dict)
async def links_bulk_create(body: SkillLinkBulkCreate):
    """Create multiple skill links for a source at once."""
    return bulk_create_links(source_id=body.source_id, skill_ids=body.skill_ids)


@router.put("/links/{source_id}", response_model=dict)
async def links_replace(source_id: str, body: SkillLinkBulkCreate):
    """Replace all skill links for a source."""
    return replace_links_for_source(source_id=source_id, skill_ids=body.skill_ids)


@router.delete("/links/{link_id}", response_model=dict)
async def links_delete(link_id: str):
    """Delete a single skill-to-source mapping."""
    return delete_link(link_id)


# ── Cert Details ─────────────────────────────────────────────

@router.get("/details/cert/{source_id}", response_model=dict)
async def cert_detail_get(source_id: str):
    """Get certification detail for a source."""
    detail = get_cert_detail(source_id)
    if not detail:
        raise HTTPException(404, f"No cert detail for '{source_id}'")
    return detail


@router.put("/details/cert", response_model=dict)
async def cert_detail_upsert(body: CertDetailCreate):
    """Create or update certification detail."""
    return upsert_cert_detail(body.model_dump())


@router.patch("/details/cert/{source_id}", response_model=dict)
async def cert_detail_update(source_id: str, body: CertDetailUpdate):
    """Partial update of certification detail."""
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["source_id"] = source_id
    return upsert_cert_detail(updates)


@router.delete("/details/cert/{source_id}", response_model=dict)
async def cert_detail_delete(source_id: str):
    """Delete certification detail."""
    return delete_cert_detail(source_id)


# ── Evidence Item Details ────────────────────────────────────

@router.get("/details/item/{source_id}", response_model=dict)
async def item_detail_get(source_id: str):
    """Get item detail for a prototype/project/teardown."""
    detail = get_item_detail(source_id)
    if not detail:
        raise HTTPException(404, f"No item detail for '{source_id}'")
    return detail


@router.put("/details/item", response_model=dict)
async def item_detail_upsert(body: ItemDetailCreate):
    """Create or update item detail."""
    return upsert_item_detail(body.model_dump())


@router.patch("/details/item/{source_id}", response_model=dict)
async def item_detail_update(source_id: str, body: ItemDetailUpdate):
    """Partial update of item detail."""
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["source_id"] = source_id
    return upsert_item_detail(updates)


@router.delete("/details/item/{source_id}", response_model=dict)
async def item_detail_delete(source_id: str):
    """Delete item detail."""
    return delete_item_detail(source_id)


# ── Gap Items ("Mind the Gap") ───────────────────────────────


@router.get("/gap-items")
async def gap_items_list(category: str = None, status: str = None, priority: str = None):
    return list_gap_items(category=category, status=status, priority=priority)


@router.get("/gap-items/stats")
async def gap_items_stats():
    return gap_stats()


@router.get("/gap-items/{item_id}")
async def gap_item_get(item_id: str):
    try:
        return get_gap_item(item_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.post("/gap-items", status_code=201)
async def gap_item_create(body: GapItemCreate):
    try:
        return create_gap_item(**body.model_dump())
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, f"Gap item '{body.id}' already exists")
        raise


@router.patch("/gap-items/{item_id}")
async def gap_item_update(item_id: str, body: GapItemUpdate):
    try:
        return update_gap_item(item_id, **body.model_dump())
    except NotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/gap-items/{item_id}")
async def gap_item_delete(item_id: str):
    try:
        return delete_gap_item(item_id)
    except NotFoundError as e:
        raise HTTPException(404, str(e))


# ── Publish ──────────────────────────────────────────────────

@router.get("/manifest", response_model=dict)
async def manifest_preview():
    """Preview the full evidence manifest (without publishing)."""
    return generate_manifest()


@router.post("/publish", response_model=dict)
async def manifest_publish():
    """Generate manifest and publish to site repo via git."""
    from services.git_handler import GitHandler

    manifest = generate_manifest()

    git = GitHandler()
    await git.clone_or_pull()

    # Write manifest to site repo
    manifest_path = os.path.join(git.local_path, "data", "skills-evidence.json")
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    # Git add, commit, push
    git._run(["git", "add", "data/skills-evidence.json"])

    try:
        git._run([
            "git", "commit", "-m",
            f"Update skills evidence manifest ({manifest['SKILLS_DATA']['sources'].__len__()} sources, "
            f"{manifest['SKILLS_DATA']['links'].__len__()} links)"
        ])
    except RuntimeError as e:
        if "nothing to commit" in str(e):
            return {"success": True, "message": "No changes to publish", "manifest": manifest}
        raise

    git._run(["git", "push"])

    # Fire notification
    try:
        from services.notification_service import create_notification
        create_notification(
            type="draft_content",
            title="Skills evidence manifest published",
            summary=f"{len(manifest['SKILLS_DATA']['sources'])} sources, {len(manifest['SKILLS_DATA']['links'])} links",
            source="evidence_service",
            action_url="/dashboard/add-skills",
            priority="normal",
        )
    except Exception as e:
        logger.warning("Failed to create publish notification: %s", e)

    return {"success": True, "message": "Manifest published to site repo", "manifest": manifest}
