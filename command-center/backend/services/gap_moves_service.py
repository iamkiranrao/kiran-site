"""Gap Closure Moves service — CRUD, step toggling, progress scoring, and batch resolution.

Moves are stored as individual JSON files in ~/.command-center/data/gap_closure_moves/.
Each move maps to many gap items and contains a detailed step-by-step plan.
"""

import json
import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

from utils.config import data_dir
from utils.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

MOVES_DIR = data_dir("gap_closure_moves")


# ── File helpers ─────────────────────────────────────────────

def _move_path(move_id: str) -> str:
    return os.path.join(MOVES_DIR, f"{move_id}.json")


def _load_move(move_id: str) -> dict:
    path = _move_path(move_id)
    if not os.path.exists(path):
        raise NotFoundError(f"Move '{move_id}' not found")
    with open(path) as f:
        return json.load(f)


def _save_move(move: dict):
    move["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(_move_path(move["id"]), "w") as f:
        json.dump(move, f, indent=2)


def _all_move_files() -> List[str]:
    if not os.path.exists(MOVES_DIR):
        return []
    return [f for f in os.listdir(MOVES_DIR) if f.endswith(".json")]


# ── CRUD ─────────────────────────────────────────────────────

def list_moves() -> List[dict]:
    moves = []
    for fname in _all_move_files():
        with open(os.path.join(MOVES_DIR, fname)) as f:
            moves.append(json.load(f))
    moves.sort(key=lambda m: m.get("sort_order", 99))
    return moves


def get_move(move_id: str) -> dict:
    return _load_move(move_id)


def create_move(data: dict) -> dict:
    move_id = data["id"]
    if os.path.exists(_move_path(move_id)):
        raise ValidationError(f"Move '{move_id}' already exists")
    now = datetime.now(timezone.utc).isoformat()
    move = {
        "id": move_id,
        "title": data["title"],
        "move_type": data.get("move_type", "reframe"),
        "estimated_time": data.get("estimated_time", "TBD"),
        "gap_ids": data.get("gap_ids", []),
        "resolution_type": data.get("resolution_type", "reframed"),
        "status": "not-started",
        "steps": data.get("steps", []),
        "initiative_ids": [],
        "notes": "",
        "sort_order": data.get("sort_order", 99),
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        # Enrichment fields — populated by enrich_move()
        "vault_record_draft": data.get("vault_record_draft"),
        "interview_stories": data.get("interview_stories", []),
        "enriched_at": None,
    }
    # Ensure each step has an index and status
    for i, step in enumerate(move["steps"]):
        step.setdefault("index", i)
        step.setdefault("status", "pending")
        step.setdefault("completed_at", None)
    _save_move(move)
    return move


def update_move(move_id: str, updates: dict) -> dict:
    move = _load_move(move_id)
    for key in ("title", "status", "notes", "gap_ids", "resolution_type", "estimated_time", "sort_order"):
        if key in updates and updates[key] is not None:
            move[key] = updates[key]
    if updates.get("status") == "completed" and not move.get("completed_at"):
        move["completed_at"] = datetime.now(timezone.utc).isoformat()
    _save_move(move)
    return move


def delete_move(move_id: str):
    path = _move_path(move_id)
    if not os.path.exists(path):
        raise NotFoundError(f"Move '{move_id}' not found")
    os.remove(path)


# ── Step toggling ────────────────────────────────────────────

def update_step(move_id: str, step_index: int, updates: dict) -> dict:
    move = _load_move(move_id)
    if step_index < 0 or step_index >= len(move["steps"]):
        raise ValidationError(f"Step index {step_index} out of range (0-{len(move['steps'])-1})")
    step = move["steps"][step_index]
    old_status = step.get("status", "pending")
    if "status" in updates:
        step["status"] = updates["status"]
        if updates["status"] == "completed":
            step["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif updates["status"] == "pending":
            step["completed_at"] = None
    if "notes" in updates and updates["notes"] is not None:
        step["notes"] = updates["notes"]
    new_status = step.get("status", "pending")

    # ── Sync mapped gap items in Supabase ────────────────────
    step_gap_ids = step.get("gap_ids", [])
    if step_gap_ids and old_status != new_status:
        _sync_step_gaps(step, old_status, new_status)

    # Auto-update move status based on steps
    statuses = [s["status"] for s in move["steps"]]
    if all(s in ("completed", "skipped") for s in statuses):
        move["status"] = "completed"
        move["completed_at"] = datetime.now(timezone.utc).isoformat()
    elif any(s in ("in-progress", "completed") for s in statuses):
        move["status"] = "in-progress"
    _save_move(move)
    return move


def _sync_step_gaps(step: dict, old_status: str, new_status: str):
    """When a step with mapped gap_ids is checked/unchecked, resolve or revert those gaps in Supabase."""
    from services.evidence_service import update_gap_item

    gap_ids = step.get("gap_ids", [])
    resolution_type = step.get("resolution_type", "not-pursuing")

    if not gap_ids:
        return

    if new_status == "completed" and old_status != "completed":
        # Resolve all mapped gaps
        new_gap_status = "deprioritized" if resolution_type == "not-pursuing" else "completed"
        for gid in gap_ids:
            try:
                update_gap_item(gid,
                    current_status=new_gap_status,
                    resolution_type=resolution_type,
                    resolution_note=f"Bulk-resolved via Move 10 step: {step.get('title', '')}"
                )
                # Auto-create vault entry for evidence-producing resolutions
                if resolution_type in ("built-proof", "certified", "reframed"):
                    try:
                        from services.evidence_service import create_vault_entry_from_gap
                        create_vault_entry_from_gap(gid)
                    except Exception as ve:
                        logger.warning(f"Vault entry creation failed for {gid}: {ve}")
            except Exception as e:
                logger.warning(f"Failed to resolve gap {gid}: {e}")

    elif new_status == "pending" and old_status == "completed":
        # Revert all mapped gaps back to not-started
        # Use _revert_gap_item directly since update_gap_item filters None values
        from services.evidence_service import _get_client
        sb = _get_client()
        for gid in gap_ids:
            try:
                sb.table("evidence_gap_items").update({
                    "current_status": "not-started",
                    "resolution_type": None,
                    "resolution_note": None,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", gid).execute()
            except Exception as e:
                logger.warning(f"Failed to revert gap {gid}: {e}")


# ── Progress scoring ─────────────────────────────────────────

# Credit weights per fill tier — reflects how much of the gap Kiran
# effectively covers TODAY without doing any additional work.
TIER_CREDIT = {
    "articulate": 0.90,   # Has the skill, just needs better documentation
    "build-proof": 0.60,  # Has the knowledge, needs a tangible artifact
    "certify": 0.50,      # Knows it, needs the paper
    "true-gap": 0.10,     # Genuinely new territory (some adjacent knowledge)
    "unclassified": 0.50, # Mixed bag
}


def _compute_readiness_score() -> dict:
    """Calculate Kiran's readiness score — baseline + progress from resolved gaps.

    Only JD-sourced gaps (source_jd_company is set) count toward the score.
    Manually-seeded aspirational gaps (horizon-expanders etc.) are excluded
    so they don't dilute the readiness calculation.
    """
    try:
        from services.evidence_service import list_gap_items
        all_gaps = list_gap_items()
        all_entries = all_gaps.get("entries", [])
    except Exception as e:
        logger.warning(f"Could not fetch gap items for readiness score: {e}")
        return {"baseline_pct": 0, "current_pct": 0, "total_gaps": 0, "tier_breakdown": {}}

    # Only score JD-sourced gaps — manual/aspirational gaps are tracked but don't affect readiness
    entries = [g for g in all_entries if g.get("source_jd_company")]
    excluded_count = len(all_entries) - len(entries)

    if not entries:
        return {"baseline_pct": 0, "current_pct": 0, "total_gaps": 0, "tier_breakdown": {}}

    total = len(entries)
    baseline_score = 0.0
    current_score = 0.0
    tier_counts = {}

    resolved_statuses = {"have-it", "reframed", "built-proof", "certified", "not-pursuing", "not-a-gap"}
    closed_statuses = {"closed", "completed", "deprioritized"}

    for gap in entries:
        tier = gap.get("fill_tier") or "unclassified"
        credit = TIER_CREDIT.get(tier, 0.50)
        baseline_score += credit

        # If gap is resolved, it gets full credit in current score
        is_resolved = (
            gap.get("resolution_type") in resolved_statuses
            or gap.get("current_status") in closed_statuses
        )
        current_score += 1.0 if is_resolved else credit

        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    baseline_pct = round(baseline_score / total * 100)
    current_pct = round(current_score / total * 100)

    return {
        "baseline_pct": baseline_pct,
        "current_pct": current_pct,
        "total_gaps": total,
        "excluded_aspirational": excluded_count,
        "resolved_gaps": sum(1 for g in entries if g.get("resolution_type") in resolved_statuses or g.get("current_status") in closed_statuses),
        "tier_breakdown": {
            tier: {"count": count, "credit": TIER_CREDIT.get(tier, 0.50)}
            for tier, count in sorted(tier_counts.items(), key=lambda x: -x[1])
        },
    }


def get_company_readiness() -> list:
    """Per-company readiness: group gap items by source_jd_company, compute coverage per company."""
    try:
        from services.evidence_service import list_gap_items
        all_gaps = list_gap_items()
        entries = all_gaps.get("entries", [])
    except Exception as e:
        logger.warning(f"Could not fetch gap items for company readiness: {e}")
        return []

    resolved_statuses = {"have-it", "reframed", "built-proof", "certified", "not-pursuing", "not-a-gap"}
    closed_statuses = {"closed", "completed", "deprioritized"}

    # Group by company
    companies: Dict[str, dict] = {}
    for gap in entries:
        company = gap.get("source_jd_company")
        if not company:
            continue

        if company not in companies:
            companies[company] = {
                "company": company,
                "roles": set(),
                "total_gaps": 0,
                "resolved_gaps": 0,
                "gaps_by_priority": {"critical": 0, "high": 0, "medium": 0, "low": 0, "nice-to-have": 0},
                "gaps_by_resolution": {},
                "open_gaps": [],
            }

        c = companies[company]
        c["total_gaps"] += 1
        role = gap.get("source_jd_role")
        if role:
            c["roles"].add(role)

        priority = gap.get("priority", "medium")
        c["gaps_by_priority"][priority] = c["gaps_by_priority"].get(priority, 0) + 1

        is_resolved = (
            gap.get("resolution_type") in resolved_statuses
            or gap.get("current_status") in closed_statuses
        )
        if is_resolved:
            c["resolved_gaps"] += 1
            res_type = gap.get("resolution_type", "unknown")
            c["gaps_by_resolution"][res_type] = c["gaps_by_resolution"].get(res_type, 0) + 1
        else:
            c["open_gaps"].append({
                "id": gap["id"],
                "title": gap.get("title", ""),
                "priority": priority,
                "category": gap.get("category", ""),
                "fill_tier": gap.get("fill_tier"),
                "fill_action": gap.get("fill_action"),
            })

    # Compute readiness % and sort
    result = []
    for c in companies.values():
        total = c["total_gaps"]
        resolved = c["resolved_gaps"]
        c["readiness_pct"] = round(resolved / total * 100) if total else 0
        c["roles"] = sorted(c["roles"])
        # Sort open gaps: critical first, then high, etc.
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "nice-to-have": 4}
        c["open_gaps"].sort(key=lambda g: priority_order.get(g["priority"], 5))
        result.append(c)

    # Sort: closest to ready first (highest readiness_pct), then by most gaps (more data = more relevant)
    result.sort(key=lambda c: (-c["readiness_pct"], -c["total_gaps"]))
    return result


def get_progress() -> dict:
    moves = list_moves()
    total_gaps = set()
    closed_gaps = set()
    move_summaries = []
    for m in moves:
        steps = m.get("steps", [])
        done = sum(1 for s in steps if s.get("status") in ("completed", "skipped"))
        total = len(steps)
        pct = round(done / total * 100) if total else 0
        gap_count = len(m.get("gap_ids", []))
        total_gaps.update(m.get("gap_ids", []))
        if m.get("status") == "completed":
            closed_gaps.update(m.get("gap_ids", []))
        move_summaries.append({
            "id": m["id"],
            "title": m["title"],
            "status": m["status"],
            "steps_done": done,
            "steps_total": total,
            "progress_pct": pct,
            "gaps_covered": gap_count,
        })
    overall_gaps_covered = len(total_gaps)
    overall_gaps_closed = len(closed_gaps)

    readiness = _compute_readiness_score()

    return {
        "total_moves": len(moves),
        "completed_moves": sum(1 for m in moves if m.get("status") == "completed"),
        "in_progress_moves": sum(1 for m in moves if m.get("status") == "in-progress"),
        "total_gaps_covered": overall_gaps_covered,
        "gaps_closed": overall_gaps_closed,
        "gap_closure_pct": round(overall_gaps_closed / overall_gaps_covered * 100) if overall_gaps_covered else 0,
        "readiness": readiness,
        "moves": move_summaries,
    }


# ── Batch gap resolution ────────────────────────────────────

def complete_move_and_resolve_gaps(move_id: str) -> dict:
    """Mark a move as completed and batch-resolve all linked gaps."""
    move = _load_move(move_id)
    move["status"] = "completed"
    move["completed_at"] = datetime.now(timezone.utc).isoformat()
    for step in move["steps"]:
        if step["status"] == "pending":
            step["status"] = "completed"
            step["completed_at"] = move["completed_at"]
    _save_move(move)

    # Resolve linked gaps in Supabase
    resolved_count = 0
    resolution_type = move.get("resolution_type", "reframed")
    try:
        from services.evidence_service import update_gap_item
        for gap_id in move.get("gap_ids", []):
            try:
                update_gap_item(gap_id, {
                    "resolution_type": resolution_type,
                    "resolution_note": f"Closed by move: {move['title']}",
                    "current_status": "closed",
                })
                resolved_count += 1
            except Exception as e:
                logger.warning(f"Failed to resolve gap {gap_id}: {e}")
    except ImportError:
        logger.warning("evidence_service not available for gap resolution")

    # Auto-create vault entry from vault_record_draft if enriched
    vault_created = False
    vault_draft = move.get("vault_record_draft")
    if vault_draft and vault_draft.get("name"):
        try:
            _finalize_vault_from_move(move)
            vault_created = True
        except Exception as e:
            logger.warning(f"Failed to auto-create vault entry from move {move_id}: {e}")

    return {
        "move_id": move_id,
        "status": "completed",
        "gaps_resolved": resolved_count,
        "total_gaps": len(move.get("gap_ids", [])),
        "vault_created": vault_created,
    }


def _finalize_vault_from_move(move: dict):
    """Create a rich vault entry from the move's vault_record_draft.

    Same pattern as closure plan finalization — creates both the
    evidence_sources entry AND the detail record.
    """
    from services.evidence_service import (
        create_source, upsert_item_detail, upsert_cert_detail,
    )

    draft = move.get("vault_record_draft", {})
    if not draft or not draft.get("name"):
        return

    source_id = f"move-{move['id']}"
    source_type = draft.get("type", "project")
    type_map = {"prototype": "prototype", "certification": "certification", "project": "project", "teardown": "teardown"}
    ev_type = type_map.get(source_type, "project")

    # 1. Create evidence_sources entry
    try:
        create_source(
            id=source_id,
            label=draft.get("name", f"Move: {move.get('title', move['id'])}"),
            type=ev_type,
            issuer="Self",
            year=str(datetime.now(timezone.utc).year),
            url=None,
        )
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            raise
        logger.info(f"Source {source_id} already exists, updating details only")

    # 2. Create the rich detail record
    if ev_type == "certification":
        upsert_cert_detail({
            "source_id": source_id,
            "display_skills": draft.get("display_skills", []),
            "learned": draft.get("learned", ""),
            "capstone": draft.get("capstone", ""),
        })
    else:
        upsert_item_detail({
            "source_id": source_id,
            "description": draft.get("description", ""),
            "tech_stack": draft.get("tech_stack", []),
            "display_skills": draft.get("display_skills", []),
            "highlight": draft.get("highlight", ""),
            "tagline": draft.get("tagline", ""),
        })

    logger.info(f"Vault entry finalized from move: {source_id} ({ev_type})")

    # Push to RAG embeddings so Fenix can find this evidence
    try:
        from services.evidence_embedding_service import embed_evidence_source
        embed_evidence_source(source_id)
        logger.info(f"Evidence pushed to RAG embeddings: {source_id}")
    except Exception as e:
        logger.warning(f"RAG embedding push failed for {source_id}: {e} (vault entry still created)")


# ── Move Enrichment — add granular guidance via Claude ──────


def enrich_move(client, move_id: str) -> dict:
    """Enrich a move with granular closure guidance using Claude.

    Takes the move's existing steps and generates:
    - Per step: what_good_looks_like, prototype_idea, vault_fields_fed
    - Per move: vault_record_draft, interview_stories

    This is the same philosophy as closure plans — by the time you finish
    the move, a rich vault record exists and interview stories are ready.
    """
    from services.gap_closure_service import (
        _call_claude, _parse_json_response, _load_initiatives,
        _build_vault_summary, CAREER_CONTEXT,
    )

    move = _load_move(move_id)

    # Skip disposition moves — they're just cleanup
    if move.get("move_type") == "disposition":
        return move

    # Build context
    initiatives = _load_initiatives()
    vault_summary = _build_vault_summary(initiatives) if initiatives else "No vault data available."

    # Get gap titles for context
    gap_titles = []
    try:
        from services.evidence_service import get_gap_item
        for gid in move.get("gap_ids", [])[:15]:  # Cap to avoid token overflow
            try:
                gap = get_gap_item(gid)
                gap_titles.append(f"- {gap.get('title', gid)} (fill_tier: {gap.get('fill_tier', '?')}, company: {gap.get('source_jd_company', '?')})")
            except Exception:
                gap_titles.append(f"- {gid}")
    except Exception:
        pass

    # Build step summaries for the prompt
    step_lines = []
    for i, step in enumerate(move.get("steps", [])):
        step_lines.append(
            f"Step {i}: {step.get('title', 'Untitled')}\n"
            f"  Description: {step.get('description', '')[:300]}\n"
            f"  Time: {step.get('time', 'TBD')}\n"
            f"  Produces: {step.get('produces', 'TBD')}"
        )

    system_prompt = (
        "You are a career strategy advisor enriching a strategic move with granular, actionable guidance. "
        "This move is part of Kiran Rao's gap closure system. Your job is to make every step so specific "
        "that Kiran knows EXACTLY what to do, what good looks like, and what vault evidence it produces.\n\n"
        "Two outputs must be true when the move is complete:\n"
        "1. The career vault has a rich, detailed record that an AI assistant can reference\n"
        "2. Interview prep stories are written in STAR format, grounded in real work, ready to rehearse\n\n"
        "Be extremely specific. Not 'write a case study' but 'write a 500-word case study with these 4 sections, "
        "here's what good looks like.' Every step must be a guide AND a template."
    )

    prompt = f"""Enrich this strategic move with granular closure guidance.

## THE MOVE
- Title: {move.get('title', '')}
- Type: {move.get('move_type', '')}
- Resolution type: {move.get('resolution_type', '')}
- Estimated time: {move.get('estimated_time', '')}

## GAPS THIS MOVE CLOSES ({len(move.get('gap_ids', []))} gaps)
{chr(10).join(gap_titles) if gap_titles else 'Gap details not available'}

## EXISTING STEPS
{chr(10).join(step_lines)}

## KIRAN'S CAREER CONTEXT
{CAREER_CONTEXT}

## KIRAN'S VAULT
{vault_summary}

---

Generate enrichment as JSON with this structure:

{{
  "enriched_steps": [
    {{
      "step_index": 0,
      "what_good_looks_like": "A concrete example, model, or template of what the output should look like. Be specific — if it's writing, describe the structure (sections, word count, what each section covers, a model to follow). If it's building, specify scope, tech approach, and what 'done' looks like. If it's a certification, describe the key modules to focus on and what insights to extract.",
      "prototype_idea": "If this step involves building or creating something, describe the specific artifact: what is it, what does it demonstrate, minimum viable version vs impressive version. Null if the step is studying or administrative.",
      "vault_fields_fed": ["Which vault record fields this step produces content for: description, tech_stack, display_skills, highlight, tagline, learned, capstone"],
      "resources": [
        {{"title": "Specific resource name", "url": "URL if known", "type": "article|course|certification|book|tool|example", "what_to_extract": "What specifically to get from this resource — not 'learn about X' but 'extract their framework for Y and adapt it to Z'"}}
      ]
    }}
  ],
  "vault_record_draft": {{
    "type": "prototype|certification|project|teardown",
    "name": "Evidence title for the vault card",
    "tagline": "One punchy sentence for card display (15 words max)",
    "description": "3-5 sentence description. Use [BRACKETS] where Kiran needs to fill in specifics from actual work.",
    "tech_stack": ["Technologies, methodologies, or frameworks involved"],
    "display_skills": ["4-6 skills this evidence demonstrates — use JD language"],
    "highlight": "The single most impressive detail. [Include placeholder for actual metric/outcome]",
    "status": "Draft — will be finalized after move completion",
    "learned": "The key technical or strategic learning from completing this move.",
    "capstone": "The capstone artifact that ties it all together. What someone would look at to judge the quality."
  }},
  "interview_stories": [
    {{
      "question": "An actual interview question this move's evidence answers",
      "story_title": "Short label (e.g., 'WF Mobile Analytics Overhaul')",
      "situation": "STAR S — 2-3 sentences with [BRACKETS] for Kiran to fill in specifics",
      "task": "STAR T — the specific challenge. What made it hard.",
      "action": "STAR A — 3-5 sentences. Decisions, frameworks, tradeoffs. Concrete about tools and WHY each choice was made.",
      "result": "STAR R — measurable outcome. [Placeholder for actual metrics]. Business impact.",
      "follow_ups": [
        {{
          "question": "A drill-down question the interviewer would ask",
          "answer_guidance": "How to handle it — what to emphasize, what the interviewer is really testing"
        }}
      ],
      "source_initiatives": ["vault initiative IDs this story draws from"],
      "confidence": "high|medium|low — based on existing vault evidence vs needs new work"
    }}
  ]
}}

CRITICAL INSTRUCTIONS:
- enriched_steps must have one entry per existing step, matching by step_index (0-based)
- what_good_looks_like must be genuinely useful — a template, example, or model. Not "make it good."
- vault_record_draft should be as complete as possible using existing vault data, with [BRACKETS] for what needs filling in
- interview_stories: generate 3-5 stories grounded in REAL vault initiatives wherever possible
- Resources should be REAL and SPECIFIC — actual course names, blog posts, tools
- For the vault_record_draft, pick the type that best matches what the move produces (certification moves → certification, build moves → prototype, reframe moves → project)
"""

    response_text = _call_claude(client, prompt, max_tokens=6000, system=system_prompt)
    enrichment = _parse_json_response(response_text)

    # Merge enriched fields into existing steps
    enriched_steps = {s["step_index"]: s for s in enrichment.get("enriched_steps", [])}
    for i, step in enumerate(move.get("steps", [])):
        if i in enriched_steps:
            es = enriched_steps[i]
            step["what_good_looks_like"] = es.get("what_good_looks_like")
            step["prototype_idea"] = es.get("prototype_idea")
            step["vault_fields_fed"] = es.get("vault_fields_fed", [])
            step["resources"] = es.get("resources", [])

    # Set move-level enrichment
    move["vault_record_draft"] = enrichment.get("vault_record_draft", {})
    move["interview_stories"] = enrichment.get("interview_stories", [])
    move["enriched_at"] = datetime.now(timezone.utc).isoformat()

    _save_move(move)
    logger.info(f"Move enriched: {move_id} | {len(enriched_steps)} steps enriched | "
                f"{len(move.get('interview_stories', []))} interview stories generated")

    return move


# ── Seed data ────────────────────────────────────────────────

def seed_moves(force: bool = False) -> dict:
    """Seed the 10 strategic moves with full step-by-step plans."""
    created = 0
    skipped = 0
    for move_data in SEED_MOVES:
        path = _move_path(move_data["id"])
        if os.path.exists(path):
            if not force:
                skipped += 1
                continue
            os.remove(path)  # Delete existing so create_move succeeds
        create_move(move_data)
        created += 1
    return {"created": created, "skipped": skipped, "total": len(SEED_MOVES)}


SEED_MOVES = [
    {
        "id": "vault-rewrite",
        "title": "Deep Vault Rewrite \u2014 Technical Architecture Edition",
        "move_type": "reframe",
        "estimated_time": "2-3 weekends",
        "sort_order": 1,
        "resolution_type": "reframed",
        "gap_ids": [
            "jd-0c9419", "jd-d6bc0d", "jd-084529", "jd-4d709d", "jd-6529f6",
            "jd-088054", "jd-b91c20", "jd-6744b3", "jd-719189", "jd-576a10",
            "jd-5ef75a", "jd-03681a", "jd-0a3b78", "jd-e7ff91", "jd-0d9d55",
            "jd-7f9f32", "jd-29ed0e", "jd-1a113c", "jd-773dd3", "jd-a659ce",
            "jd-5cf323", "jd-d8fa36", "jd-4bbff6", "jd-3a5fd0", "jd-8672f6",
            "jd-a62f54", "jd-db7523", "jd-5984d9", "jd-b5d36a", "jd-319b59",
            "jd-7af284", "jd-c6acb5", "jd-6f9fe2", "jd-7e97cb", "jd-de71e0",
            "jd-3c47f9", "jd-5eb135", "jd-d3e73e", "jd-96d48f", "jd-b8758b",
            "jd-4f9815", "jd-eaac8a", "jd-e099ec", "jd-3b136c", "jd-253df8",
            "jd-9dfe0b", "jd-e57a65", "jd-2726c9", "jd-777131", "jd-59ed24",
            "jd-0e2e97", "gap-pricing-monetization", "gap-roadmapping", "framework-okrs", "jd-b87ab7",
            "jd-c14507", "jd-5f39dc", "jd-74f295", "jd-c9f92e", "jd-09c057",
            "jd-0dc308", "jd-8dbbed", "jd-231690", "cert-product-school-pmc", "cert-pragmatic-institute",
            "persona-system-design", "persona-fullstack-demo", "domain-technical-pm", "domain-platform-pm", "adjacent-customer-success",
            "adjacent-sql-advanced", "framework-jtbd", "horizon-storytelling", "horizon-writing", "horizon-economics"
        ],
        "steps": [
            {"title": "Audit current vault initiatives", "description": "Export all career vault entries. List which ones have metrics, technical depth, and architecture details vs. which are thin summaries. Identify the 15-20 highest-leverage initiatives that map to the most gaps.", "time": "2 hours", "produces": "vault-audit spreadsheet"},
            {"title": "Write technical architecture narratives", "description": "For each top initiative, write a 300-500 word architecture narrative: what was the system, what were the constraints, what did you design, what tradeoffs did you navigate, what was the measurable outcome. Focus on system design, scalability, data pipelines, and ML integration.", "time": "6-8 hours", "produces": "15-20 architecture narratives"},
            {"title": "Add quantitative metrics to every initiative", "description": "Go through each initiative and ensure it has concrete metrics: revenue impact, latency reduction, user growth, cost savings, team velocity. Where exact numbers aren't available, use defensible ranges with methodology notes.", "time": "3 hours", "produces": "metrics-enriched initiatives"},
            {"title": "Map initiatives to gap categories", "description": "For each gap this move covers, identify which vault initiative(s) now address it. Update the mapping so Fenix can reference the right evidence when discussing these capabilities.", "time": "2 hours", "produces": "gap-to-initiative mapping"},
            {"title": "Create cross-functional impact stories", "description": "Write 5-7 stories that demonstrate working across engineering, design, data science, and business teams. These close the cross-functional leadership gaps that appear across nearly every JD.", "time": "3 hours", "produces": "cross-functional narratives"},
            {"title": "Update vault entries in Command Center", "description": "Push all enriched narratives, metrics, and stories back into the career vault via CC API. Verify each entry renders correctly and has proper tags for Fenix retrieval.", "time": "2 hours", "produces": "updated vault entries"},
            {"title": "Validate with Fenix test queries", "description": "Run 10 test queries against Fenix that correspond to the gap categories this move covers. Verify Fenix retrieves the new evidence and articulates it well. Fix any retrieval gaps.", "time": "1-2 hours", "produces": "validation report"}
        ]
    },
    {
        "id": "amplitude-cert",
        "title": "Amplitude Analytics Certification + Portfolio Proof",
        "move_type": "certification",
        "estimated_time": "1-2 weeks",
        "sort_order": 2,
        "resolution_type": "certified",
        "gap_ids": [
            "jd-ad8a7d", "jd-1ca6f5", "gap-product-analytics", "gap-experimentation", "tool-amplitude",
            "tool-mixpanel", "tool-posthog", "tool-looker"
        ],
        "steps": [
            {"title": "Complete Amplitude Analytics certification", "description": "Enroll in Amplitude's free certification program. Complete all modules: event taxonomy, behavioral cohorts, funnel analysis, retention analysis, experiment design. Take the exam.", "time": "8-12 hours", "produces": "Amplitude Analytics Certificate"},
            {"title": "Build a demo analytics dashboard", "description": "Using Kiran's site analytics data (or synthetic data modeled on it), build a full Amplitude-style analysis: define events, create funnels, build cohorts, analyze retention curves. Document the methodology.", "time": "4-6 hours", "produces": "analytics case study"},
            {"title": "Write up the analytics narrative", "description": "Create a teardown-style writeup: 'How I'd instrument a product analytics stack from scratch.' Cover event taxonomy design, metric hierarchies, experimentation frameworks, and how analytics drives product decisions.", "time": "3-4 hours", "produces": "analytics methodology post"},
            {"title": "Create vault entry for analytics expertise", "description": "Push a career initiative entry that covers: Amplitude certification, analytics methodology, experimentation design, metric-driven decision making. Tag for Fenix retrieval.", "time": "1 hour", "produces": "vault entry"},
            {"title": "Integrate with existing product work", "description": "Connect this to actual product decisions from past roles \u2014 times when analytics shaped roadmap priorities, killed features, or validated hypotheses. Add these as evidence links.", "time": "2 hours", "produces": "evidence connections"}
        ]
    },
    {
        "id": "deeplearning-ai",
        "title": "DeepLearning.AI Specialization \u2014 ML/AI Product Fluency",
        "move_type": "certification",
        "estimated_time": "3-4 weeks",
        "sort_order": 3,
        "resolution_type": "certified",
        "gap_ids": [
            "jd-2cb729", "jd-8f59f1", "jd-4be15d", "jd-f2c456", "jd-491044",
            "jd-a89a47", "jd-ebda1a", "jd-f183f9", "jd-88eb1e", "cert-deeplearning-ai",
            "jd-10bc86", "jd-0e042f", "jd-913e41", "jd-7990bb", "jd-9e2517",
            "jd-25ffff", "jd-024230", "domain-ai-pm"
        ],
        "steps": [
            {"title": "Complete AI for Everyone (Andrew Ng)", "description": "Foundational course on AI concepts, workflow, and organizational strategy. Quick pass \u2014 mostly covers ground Kiran already knows but gives the certificate and shared vocabulary.", "time": "4-6 hours", "produces": "AI for Everyone certificate"},
            {"title": "Complete Generative AI with LLMs specialization", "description": "Focus on the LLM-specific track: prompt engineering, fine-tuning, RLHF, deployment patterns, evaluation methods. This directly maps to the AI/ML product management gaps.", "time": "15-20 hours", "produces": "GenAI specialization certificate"},
            {"title": "Build an ML evaluation framework", "description": "Create a reusable framework doc: 'How I evaluate ML product opportunities.' Cover: problem framing, data requirements, model selection criteria, evaluation metrics, production readiness, and business impact assessment.", "time": "4-5 hours", "produces": "ML evaluation framework"},
            {"title": "Document Fenix as an AI product case study", "description": "Write up Fenix development as a hands-on AI product case study: RAG architecture decisions, prompt engineering iterations, evaluation methodology, user experience design for AI. This is real evidence, not theoretical.", "time": "3-4 hours", "produces": "Fenix case study"},
            {"title": "Create vault entries and Fenix training", "description": "Push certifications, framework, and case study into the vault. Add Fenix training data so it can discuss AI/ML product management with depth and specifics.", "time": "2 hours", "produces": "vault entries + training data"}
        ]
    },
    {
        "id": "user-research",
        "title": "User Research Portfolio \u2014 From Insight to Impact",
        "move_type": "build",
        "estimated_time": "2 weekends",
        "sort_order": 4,
        "resolution_type": "built-proof",
        "gap_ids": [
            "jd-a5c7f4", "jd-6927e3", "jd-11475d", "jd-8964e7", "jd-761971",
            "jd-bf4630", "jd-f1c994", "jd-c6a84d", "gap-user-research"
        ],
        "steps": [
            {"title": "Compile research methods inventory", "description": "Document every research method used across career: user interviews, usability testing, A/B experiments, survey design, diary studies, contextual inquiry. For each, list a concrete example from past work.", "time": "3 hours", "produces": "research methods portfolio"},
            {"title": "Write 3 research-to-product narratives", "description": "Pick 3 instances where user research directly changed a product decision. Write each as: hypothesis \u2192 method \u2192 finding \u2192 decision \u2192 impact. These are the proof that research drives outcomes, not just reports.", "time": "4-5 hours", "produces": "3 research impact stories"},
            {"title": "Create a research ops playbook", "description": "Document a lightweight research ops system: how to recruit participants, structure interview guides, synthesize findings, and share insights with engineering. Show the operational muscle, not just the method.", "time": "3 hours", "produces": "research ops playbook"},
            {"title": "Build vault entries for research capability", "description": "Push research methods, narratives, and playbook into the career vault. Tag each with relevant gap categories so Fenix can reference them.", "time": "1 hour", "produces": "vault entries"},
            {"title": "Validate Fenix can articulate research depth", "description": "Run test prompts asking about user research experience. Verify Fenix pulls the right narratives and discusses methods with specificity, not generic PM platitudes.", "time": "1 hour", "produces": "validation results"}
        ]
    },
    {
        "id": "ai-blog-series",
        "title": "AI Product Blog Series \u2014 Thought Leadership Build",
        "move_type": "content",
        "estimated_time": "4-6 weeks (1 post/week)",
        "sort_order": 5,
        "resolution_type": "built-proof",
        "gap_ids": ["jd-bb6755", "horizon-neurodesign", "adjacent-behavioral-economics"],
        "steps": [
            {"title": "Define blog series arc", "description": "Plan 5-6 posts that build on each other: (1) AI product evaluation framework, (2) RAG architecture decisions for PMs, (3) The AI prototyping stack, (4) Measuring AI product quality, (5) AI product org design, (6) The PM's guide to prompt engineering. Each should demonstrate genuine expertise.", "time": "2 hours", "produces": "blog series outline"},
            {"title": "Write post 1: AI Product Evaluation Framework", "description": "The foundational post. How to evaluate whether an AI feature is worth building: problem clarity, data availability, model feasibility, UX complexity, business impact. Use real examples from Fenix and past work.", "time": "4-5 hours", "produces": "published blog post"},
            {"title": "Write post 2: RAG Architecture for PMs", "description": "Technical-but-accessible deep dive on RAG: when to use it, architecture decisions, embedding strategies, retrieval quality metrics. Draw directly from building Fenix.", "time": "4-5 hours", "produces": "published blog post"},
            {"title": "Write posts 3-5", "description": "Continue the series. Each post should reference Fenix, teardowns, or past work as concrete examples. Aim for 1500-2000 words each, technical enough to be credible, accessible enough to be shareable.", "time": "12-15 hours", "produces": "3 published posts"},
            {"title": "Distribute and create vault entries", "description": "Share posts through LinkedIn, relevant communities. Create vault entries for thought leadership and content creation capability. Update Fenix training data to reference the series.", "time": "2-3 hours", "produces": "distribution + vault entries"}
        ]
    },
    {
        "id": "cspo-certification",
        "title": "CSPO Certification \u2014 Agile Product Ownership",
        "move_type": "certification",
        "estimated_time": "1 weekend intensive",
        "sort_order": 6,
        "resolution_type": "certified",
        "gap_ids": [
            "jd-72dae5", "jd-8d8510", "jd-6873a1", "jd-4a2d53", "jd-7946d8",
            "cert-cspo", "adjacent-design-thinking", "tool-jira", "tool-miro"
        ],
        "steps": [
            {"title": "Register for CSPO course", "description": "Find a weekend CSPO intensive (Scrum Alliance certified). Many are available online. Cost ~$1000-1500. This is one of the most recognized PM certifications and closes agile methodology gaps across multiple JDs.", "time": "1 hour", "produces": "course registration"},
            {"title": "Complete CSPO coursework", "description": "Attend the 2-day intensive. Focus on: product backlog management, stakeholder communication, sprint planning, acceptance criteria writing, and the product owner role in scaled agile.", "time": "16 hours", "produces": "CSPO certification"},
            {"title": "Document agile practice portfolio", "description": "Write up concrete examples of agile practices from past roles: how you managed backlogs, ran sprint ceremonies, handled stakeholder conflicts, made scope tradeoff decisions. The cert validates methodology; the stories validate experience.", "time": "3-4 hours", "produces": "agile portfolio doc"},
            {"title": "Create vault entries", "description": "Push CSPO certification plus agile practice narratives into the vault. Tag for Fenix retrieval on agile/scrum/product-ownership queries.", "time": "1 hour", "produces": "vault entries"}
        ]
    },
    {
        "id": "figma-prototype",
        "title": "Figma Proficiency \u2014 Design-Fluent PM Portfolio",
        "move_type": "build",
        "estimated_time": "2 weeks",
        "sort_order": 7,
        "resolution_type": "built-proof",
        "gap_ids": ["persona-figma-fluency", "persona-xd-certification", "horizon-graphic-design"],
        "steps": [
            {"title": "Complete Figma essentials course", "description": "Take Figma's free course or a focused YouTube series. Cover: frames, auto-layout, components, variants, prototyping interactions, design system basics. Goal is fluency, not mastery \u2014 you're a PM, not a designer.", "time": "6-8 hours", "produces": "Figma proficiency"},
            {"title": "Recreate a past product spec in Figma", "description": "Pick one of the most impactful product features from past work. Create a proper Figma prototype: user flow, key screens, interaction states, edge cases. This demonstrates you can think in design, not just describe in words.", "time": "6-8 hours", "produces": "Figma prototype"},
            {"title": "Build a design system component", "description": "Create a small component library that matches the visual standards from the site. This demonstrates understanding of design systems, not just individual mockups.", "time": "3-4 hours", "produces": "Figma component library"},
            {"title": "Write up the design process narrative", "description": "Document the decisions behind the prototype: why these flows, what alternatives you considered, how user research informed the design, how you'd test it. PMs who can articulate design rationale stand out.", "time": "2-3 hours", "produces": "design process doc"},
            {"title": "Create vault entries and portfolio piece", "description": "Push Figma work as a portfolio-grade vault entry. Include screenshots/exports. Tag for design tool and design thinking queries.", "time": "1 hour", "produces": "vault entry + portfolio piece"}
        ]
    },
    {
        "id": "aws-cloud-cert",
        "title": "AWS Cloud Practitioner + Architecture Basics",
        "move_type": "certification",
        "estimated_time": "2 weeks",
        "sort_order": 8,
        "resolution_type": "certified",
        "gap_ids": [
            "jd-5374c9", "jd-0b756b", "jd-3fcf35", "jd-3c9f96", "jd-8a1543",
            "jd-75abb8"
        ],
        "steps": [
            {"title": "Complete AWS Cloud Practitioner prep", "description": "Use AWS Skill Builder (free) or A Cloud Guru. Cover: core services (EC2, S3, Lambda, RDS, DynamoDB), networking basics (VPC, CloudFront), IAM, and cost management. Focus on what a technical PM needs to know.", "time": "10-15 hours", "produces": "exam readiness"},
            {"title": "Pass AWS Cloud Practitioner exam", "description": "Schedule and take the CCP exam (~$100). This is the foundational AWS cert and closes cloud infrastructure gaps. Study tip: focus on service selection criteria and architectural best practices, not implementation details.", "time": "3 hours", "produces": "AWS CCP certification"},
            {"title": "Map cloud concepts to past architecture work", "description": "Document how cloud services relate to systems you've built or managed: data pipelines, ML serving infrastructure, web application backends. This bridges the cert to real experience.", "time": "2-3 hours", "produces": "cloud architecture narratives"},
            {"title": "Create vault entries", "description": "Push AWS cert plus architecture narratives into the vault. Tag for cloud, infrastructure, and technical depth queries.", "time": "1 hour", "produces": "vault entries"}
        ]
    },
    {
        "id": "growth-consulting",
        "title": "Growth & SEO Consulting Gig \u2014 Hands-On Growth Proof",
        "move_type": "build",
        "estimated_time": "4-8 weeks",
        "sort_order": 9,
        "resolution_type": "built-proof",
        "gap_ids": [
            "jd-9ad133", "jd-5eb5be", "jd-13faa0", "adjacent-product-marketing", "domain-growth-pm",
            "domain-digital-pm", "domain-payments-pm"
        ],
        "steps": [
            {"title": "Identify a consulting opportunity", "description": "Find a startup or small business (through network, ADPList, or pro bono) that needs growth/SEO help. Ideal: early-stage product with organic acquisition potential. This creates real, attributable proof of growth skills.", "time": "3-5 hours", "produces": "consulting engagement"},
            {"title": "Run a growth audit", "description": "Perform a full growth audit: current acquisition channels, SEO health (technical + content), conversion funnel analysis, retention metrics. Document findings and prioritized recommendations.", "time": "6-8 hours", "produces": "growth audit report"},
            {"title": "Implement quick wins", "description": "Execute 3-5 high-impact, low-effort growth improvements: SEO fixes, conversion optimizations, content strategy adjustments. Track before/after metrics rigorously.", "time": "10-15 hours", "produces": "implemented improvements + metrics"},
            {"title": "Build a growth strategy deck", "description": "Create a comprehensive growth strategy presentation: market analysis, channel prioritization, experimentation roadmap, metric framework. This becomes a portfolio piece.", "time": "4-5 hours", "produces": "growth strategy deck"},
            {"title": "Write up the case study and create vault entries", "description": "Turn the engagement into a full case study: problem \u2192 analysis \u2192 strategy \u2192 execution \u2192 results. Push into vault with growth, SEO, and go-to-market tags.", "time": "3-4 hours", "produces": "case study + vault entries"}
        ]
    },
    {
        "id": "disposition-logistics",
        "title": "Disposition \u2014 Logistics, Requirements, & Table Stakes",
        "move_type": "disposition",
        "estimated_time": "1 session",
        "sort_order": 10,
        "resolution_type": "not-pursuing",
        "gap_ids": [
            "jd-cce38a", "jd-ed9a7a", "jd-13a485", "jd-b10c4c", "jd-6a4e17",
            "jd-cf2739", "jd-83222c", "jd-5195cf", "jd-8993f6", "jd-f2cb84",
            "jd-a44375", "jd-415c03", "jd-adef6e", "jd-9694a5", "jd-ac2d09",
            "jd-460ed8", "jd-592df5", "jd-42afc9", "jd-7f52c8", "jd-cae32f",
            "jd-01840c", "jd-748552", "jd-31b5fb", "jd-b315d3", "jd-9bbbbb",
            "jd-053b4a", "jd-8f2901", "jd-e2b461", "jd-c931e8", "jd-cca480",
            "jd-9b85d3", "jd-cfaa81", "jd-f44aaf", "jd-3e25b5", "jd-cf44ca",
            "jd-9c77de", "jd-87f8a1", "jd-b33dae", "jd-bf30c1", "jd-0965fe",
            "jd-a2dfc0", "jd-afd2fb", "jd-12464f", "jd-49dc78", "jd-a3c662",
            "jd-3cb86b", "jd-c2c433", "jd-2f2ddb", "jd-72a1b0", "jd-374664",
            "jd-9ea57d", "jd-c9ce31", "jd-d0da23", "jd-f82919", "jd-3910fd",
            "jd-4566a0", "jd-e429d7", "jd-01173a", "jd-ff5852"
        ],
        "steps": [
            {"title": "Degree Requirements (26 gaps) \u2014 Reference Only", "description": "Reference list \u2014 these stay open so you can see what companies ask for in terms of education.\n\n\u2022 Bachelor's in CS, Info Systems, Engineering, Finance \u2014 Disney\n\u2022 Master's degree \u2014 Disney\n\u2022 Bachelor's in CS, Business, Engineering \u2014 McKinsey\n\u2022 Bachelor's/Master's in CS, Engineering, STEM \u2014 Deloitte\n\u2022 Bachelor's/Master's in Business, Engineering, Design, CS \u2014 Bain\n\u2022 Agile methodology mastery \u2014 Bain\n\u2022 Scrum methodology mastery \u2014 Bain\n\u2022 Developer education background \u2014 Anthropic\n\u2022 Bachelor's degree \u2014 Disney Entertainment & ESPN\n\u2022 Master's in technology or business \u2014 Google\n\u2022 Bachelor's or equivalent practical experience \u2014 OpenAI\n\u2022 Bachelor's in CS, EE, Math \u2014 Apple\n\u2022 Bachelor's or equivalent \u2014 Uber\n\u2022 STEM degree preferred \u2014 Meta\n\u2022 Master's + 7 years (alternative) \u2014 Snap\n\u2022 CS/Engineering degree \u2014 Spotify\n\u2022 Bachelor's in Engineering, Business, Design, Psychology \u2014 Duolingo\n\u2022 Desire to advance education through technology \u2014 Duolingo\n\u2022 Advanced degree in Business, CS, Design, Psychology \u2014 Duolingo\n\u2022 Educational technology knowledge \u2014 Duolingo\n\u2022 Bachelor's in EE or Computer Engineering \u2014 NVIDIA\n\u2022 Bachelor's or equivalent industry experience \u2014 Asana\n\u2022 Master's in relevant field \u2014 BCG\n\u2022 Master's in Digital Service Design, Business, Engineering \u2014 BCG\n\u2022 Bachelor's in business, engineering, CS \u2014 Shopify\n\u2022 Bachelor's/Master's from accredited institution \u2014 Robinhood", "time": "reference", "produces": "context for applications"},
            {"title": "Industry-Specific Domains (16 gaps) \u2014 Reference Only", "description": "Reference list \u2014 these stay open so you can see what niche domain knowledge companies want.\n\n\u2022 Understanding of SMB banking needs \u2014 Block\n\u2022 Digital entertainment and streaming domain \u2014 Disney\n\u2022 Product judgment in underwriting \u2014 Block\n\u2022 Learning products background \u2014 Anthropic\n\u2022 Curriculum design background \u2014 Anthropic\n\u2022 Learning science familiarity \u2014 Anthropic\n\u2022 Instructional design familiarity \u2014 Anthropic\n\u2022 Entertainment/media industries experience \u2014 Disney Entertainment & ESPN\n\u2022 In-app recording technology knowledge \u2014 Uber\n\u2022 Prior ads platform experience \u2014 Snap\n\u2022 Ads ranking background \u2014 Snap\n\u2022 AI networking domain knowledge \u2014 NVIDIA\n\u2022 Capacity management marketplace development \u2014 NVIDIA\n\u2022 Auction pricing mechanisms knowledge \u2014 NVIDIA\n\u2022 Telecom and media industry knowledge \u2014 ServiceNow\n\u2022 ServiceNow platform experience \u2014 ServiceNow", "time": "reference", "produces": "context for applications"},
            {"title": "Table Stakes (10 gaps) \u2192 have-it", "description": "Mark as have-it \u2014 every PM has these. Reference existing vault evidence.\n\n\u2022 Strong communication skills \u2014 Robinhood\n\u2022 Business and functional requirements documentation \u2014 Disney\n\u2022 Requirements gathering and documentation \u2014 Deloitte\n\u2022 Excellent written communication skills \u2014 Block\n\u2022 Excellent verbal communication skills \u2014 Block\n\u2022 Strong written and verbal communication \u2014 Anthropic\n\u2022 Executive communication skills \u2014 Disney Entertainment & ESPN\n\u2022 Excellent written and verbal communication \u2014 Adobe\n\u2022 Excellent communication and presentation skills \u2014 Asana\n\u2022 Excellent written and verbal communication \u2014 ServiceNow", "time": "5 mins", "produces": "10 gaps resolved", "resolution_type": "have-it", "gap_ids": ["jd-cce38a", "jd-b10c4c", "jd-83222c", "jd-415c03", "jd-adef6e", "jd-9694a5", "jd-460ed8", "jd-f44aaf", "jd-cf44ca", "jd-a2dfc0"]},
            {"title": "Logistics & Location (4 gaps) \u2192 not-pursuing", "description": "Mark as not-pursuing \u2014 geographic/schedule constraints, not skill gaps.\n\n\u2022 Regional travel availability \u2014 Bain\n\u2022 West Coast/PST hours availability \u2014 Netflix\n\u2022 Office presence 4+ days weekly \u2014 Snap\n\u2022 San Francisco hybrid work arrangement \u2014 Asana", "time": "2 mins", "produces": "4 gaps resolved", "resolution_type": "not-pursuing", "gap_ids": ["jd-a44375", "jd-9bbbbb", "jd-8f2901", "jd-87f8a1"]},
            {"title": "Years of Experience (2 gaps) \u2192 have-it", "description": "Mark as have-it \u2014 Kiran has 10+ years product experience.\n\n\u2022 5 years experience in software development or engineering \u2014 Google\n\u2022 Minimum 5+ years startup product management experience \u2014 BCG", "time": "1 min", "produces": "2 gaps resolved", "resolution_type": "have-it", "gap_ids": ["jd-7f52c8", "jd-bf30c1"]},
            {"title": "Accessibility (1 gap) \u2192 have-it", "description": "Mark as have-it \u2014 the site itself demonstrates accessibility practices.\n\n\u2022 Knowledge of accessibility best practices \u2014 Google", "time": "1 min", "produces": "1 gap resolved", "resolution_type": "have-it", "gap_ids": ["jd-cae32f"]}
        ]
    }
]
