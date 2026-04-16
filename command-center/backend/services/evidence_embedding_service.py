"""
Evidence → RAG Embedding Service

Takes vault evidence (sources + detail records) and pushes them into
content_embeddings so Fenix can retrieve them via semantic search.

This is Layer 3 of the evidence model:
  Layer 1: evidence_sources (thin entry)
  Layer 2: evidence_item_details / evidence_cert_details (rich record)
  Layer 3: content_embeddings (chunked text for RAG retrieval)

Uses Voyage AI (voyage-3-lite, 512 dims) and Supabase pgvector,
same as the main site content pipeline.
"""

import os
import json
import uuid
import time
import logging
from typing import Optional, Dict, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512
CHUNK_TARGET_CHARS = 2000  # ~500 tokens
SOURCE_TYPE = "evidence_vault"  # Distinguishes from published content and flame_on


def _get_supabase_config():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return url, key


def _get_voyage_key():
    key = os.getenv("VOYAGE_API_KEY", "").strip()
    if not key:
        raise RuntimeError("VOYAGE_API_KEY must be set for embedding generation")
    return key


def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed texts via Voyage AI with retry logic."""
    import httpx

    voyage_key = _get_voyage_key()
    for attempt in range(5):
        try:
            resp = httpx.post(
                "https://api.voyageai.com/v1/embeddings",
                json={"input": texts, "model": EMBEDDING_MODEL, "input_type": "document"},
                headers={
                    "Authorization": f"Bearer {voyage_key}",
                    "Content-Type": "application/json",
                },
                timeout=60,
            )
            resp.raise_for_status()
            return [d["embedding"] for d in resp.json()["data"]]
        except Exception as e:
            wait = 15 + attempt * 10
            logger.warning(f"Voyage API error (attempt {attempt+1}/5): {e}. Waiting {wait}s...")
            if attempt < 4:
                time.sleep(wait)
            else:
                raise


def _store_content_registry_entry(supabase_url: str, supabase_key: str, entry: dict):
    """Upsert a content_registry entry for the evidence."""
    import httpx

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    resp = httpx.post(
        f"{supabase_url}/rest/v1/content_registry?on_conflict=id",
        json=entry,
        headers=headers,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.warning(f"Content registry upsert failed: {resp.status_code} {resp.text[:200]}")
    else:
        logger.info(f"Content registry entry stored: {entry.get('title', entry['id'])}")


def _store_embedding_records(supabase_url: str, supabase_key: str, records: List[dict]):
    """Store embedding records in content_embeddings."""
    import httpx

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    resp = httpx.post(
        f"{supabase_url}/rest/v1/content_embeddings",
        json=records,
        headers=headers,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"Embedding store failed: {resp.status_code} {resp.text[:200]}")
        return False
    logger.info(f"Stored {len(records)} embedding chunks")
    return True


def _clear_existing_embeddings(supabase_url: str, supabase_key: str, content_registry_id: str):
    """Remove existing embeddings for a content_registry entry (before re-embedding)."""
    import httpx

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    resp = httpx.delete(
        f"{supabase_url}/rest/v1/content_embeddings?content_registry_id=eq.{content_registry_id}",
        headers=headers,
        timeout=15,
    )
    if resp.status_code in (200, 204):
        logger.info(f"Cleared existing embeddings for {content_registry_id}")


def _assemble_evidence_text(source: dict, detail: Optional[dict]) -> str:
    """Assemble rich text from vault source + detail record.

    This text is what gets chunked and embedded — it needs to be
    comprehensive enough that Fenix can answer questions about
    this evidence area with specificity.
    """
    parts = []

    # Title and type
    label = source.get("label", "Unknown")
    ev_type = source.get("type", "project")
    parts.append(f"# {label}")
    parts.append(f"Type: {ev_type} | Issuer: {source.get('issuer', 'Self')} | Year: {source.get('year', '')}")

    if detail:
        # Tagline
        if detail.get("tagline"):
            parts.append(f"\n{detail['tagline']}")

        # Description
        if detail.get("description"):
            parts.append(f"\n## Overview\n{detail['description']}")

        # Tech stack
        if detail.get("tech_stack"):
            stack = detail["tech_stack"]
            if isinstance(stack, list):
                stack = ", ".join(stack)
            parts.append(f"\n## Technologies & Methodologies\n{stack}")

        # Display skills
        if detail.get("display_skills"):
            skills = detail["display_skills"]
            if isinstance(skills, list):
                skills = ", ".join(skills)
            parts.append(f"\n## Skills Demonstrated\n{skills}")

        # Highlight
        if detail.get("highlight"):
            parts.append(f"\n## Key Highlight\n{detail['highlight']}")

        # For certifications
        if detail.get("learned"):
            parts.append(f"\n## What Was Learned\n{detail['learned']}")
        if detail.get("capstone"):
            parts.append(f"\n## Capstone\n{detail['capstone']}")

    return "\n".join(parts)


def _simple_chunk(text: str, source_id: str, registry_id: str) -> list:
    """Split text into chunks for embedding. Simple paragraph-aware chunking."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    chunk_index = 0

    for para in paragraphs:
        if len(current_chunk) + len(para) > CHUNK_TARGET_CHARS and current_chunk:
            chunks.append({
                "chunk_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"evidence:{source_id}:chunk:{chunk_index}")),
                "content_registry_id": registry_id,
                "chunk_text": current_chunk.strip(),
                "chunk_index": chunk_index,
            })
            chunk_index += 1
            current_chunk = para + "\n\n"
        else:
            current_chunk += para + "\n\n"

    # Last chunk
    if current_chunk.strip():
        chunks.append({
            "chunk_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"evidence:{source_id}:chunk:{chunk_index}")),
            "content_registry_id": registry_id,
            "chunk_text": current_chunk.strip(),
            "chunk_index": chunk_index,
        })

    return chunks


def embed_evidence_source(source_id: str) -> dict:
    """Push a single evidence source + its details into RAG embeddings.

    Fetches the source and detail records, assembles rich text, chunks it,
    embeds via Voyage AI, and stores in content_embeddings.

    Returns a summary of what was done.
    """
    from services.evidence_service import get_source, get_item_detail, get_cert_detail

    supabase_url, supabase_key = _get_supabase_config()

    # 1. Fetch source
    source = get_source(source_id)

    # 2. Fetch detail record (try item first, then cert)
    detail = get_item_detail(source_id) or get_cert_detail(source_id)

    # 3. Assemble text
    full_text = _assemble_evidence_text(source, detail)
    if len(full_text.strip()) < 50:
        return {"status": "skipped", "reason": "Insufficient content to embed", "source_id": source_id}

    # 4. Create content_registry entry
    canonical_url = f"evidence://{source_id}"
    registry_id = str(uuid.uuid5(uuid.NAMESPACE_URL, canonical_url))

    _store_content_registry_entry(supabase_url, supabase_key, {
        "id": registry_id,
        "content_type": "evidence",
        "title": source.get("label", source_id),
        "url": canonical_url,
        "raw_text": full_text[:50000],
        "metadata": json.dumps({
            "skills": (detail.get("display_skills", []) if detail else []),
            "themes": [],
            "industry": "",
            "company": source.get("issuer", ""),
            "summary": (detail.get("tagline", "") if detail else ""),
            "connections": [],
            "source_type": SOURCE_TYPE,
            "evidence_type": source.get("type", ""),
        }),
        "source_type": SOURCE_TYPE,
    })

    # 5. Clear existing embeddings for this source (re-embed)
    _clear_existing_embeddings(supabase_url, supabase_key, registry_id)

    # 6. Chunk
    chunks = _simple_chunk(full_text, source_id, registry_id)
    if not chunks:
        return {"status": "skipped", "reason": "No chunks produced", "source_id": source_id}

    # 7. Embed
    texts = [c["chunk_text"] for c in chunks]
    embeddings = _embed_texts(texts)

    # 8. Store
    records = [
        {
            "id": c["chunk_id"],
            "content_registry_id": c["content_registry_id"],
            "chunk_text": c["chunk_text"][:10000],
            "chunk_index": c["chunk_index"],
            "embedding": str(emb),
            "metadata": json.dumps({
                "source_type": SOURCE_TYPE,
                "evidence_id": source_id,
                "evidence_type": source.get("type", ""),
                "skills": (detail.get("display_skills", []) if detail else []),
            }),
            "source_type": SOURCE_TYPE,
        }
        for c, emb in zip(chunks, embeddings)
    ]

    success = _store_embedding_records(supabase_url, supabase_key, records)

    return {
        "status": "success" if success else "partial_failure",
        "source_id": source_id,
        "chunks_embedded": len(records),
        "text_length": len(full_text),
    }


def embed_closure_plan_narrative(plan: dict) -> dict:
    """Embed a closure plan's key sections into RAG.

    This pushes the vault_record_draft + interview_stories as
    embeddable content so Fenix can reference closure plan outputs.
    """
    supabase_url, supabase_key = _get_supabase_config()

    gap_id = plan.get("gap_id", "unknown")
    gap_title = plan.get("gap_title", "")
    vault_draft = plan.get("vault_record_draft", {})
    stories = plan.get("interview_stories", [])

    # Build comprehensive text
    parts = [f"# Gap Closure Evidence: {gap_title}"]
    parts.append(f"Calibrated to: {plan.get('calibrated_to', 'General')}")

    if vault_draft:
        parts.append(f"\n## Vault Record: {vault_draft.get('name', gap_title)}")
        if vault_draft.get("tagline"):
            parts.append(vault_draft["tagline"])
        if vault_draft.get("description"):
            parts.append(f"\n{vault_draft['description']}")
        if vault_draft.get("tech_stack"):
            parts.append(f"\nTech/Methodologies: {', '.join(vault_draft['tech_stack']) if isinstance(vault_draft['tech_stack'], list) else vault_draft['tech_stack']}")
        if vault_draft.get("highlight"):
            parts.append(f"\nKey Highlight: {vault_draft['highlight']}")

    if stories:
        parts.append("\n## Interview Stories")
        for story in stories:
            parts.append(f"\n### {story.get('story_title', 'Story')}")
            parts.append(f"Question: {story.get('question', '')}")
            parts.append(f"Situation: {story.get('situation', '')}")
            parts.append(f"Task: {story.get('task', '')}")
            parts.append(f"Action: {story.get('action', '')}")
            parts.append(f"Result: {story.get('result', '')}")

    full_text = "\n".join(parts)
    if len(full_text.strip()) < 50:
        return {"status": "skipped", "reason": "Insufficient content"}

    # Registry + embed
    canonical_url = f"evidence://closure-plan-{gap_id}"
    registry_id = str(uuid.uuid5(uuid.NAMESPACE_URL, canonical_url))

    _store_content_registry_entry(supabase_url, supabase_key, {
        "id": registry_id,
        "content_type": "evidence",
        "title": f"Gap Closure: {gap_title}",
        "url": canonical_url,
        "raw_text": full_text[:50000],
        "metadata": json.dumps({
            "skills": vault_draft.get("display_skills", []) if vault_draft else [],
            "themes": ["gap-closure"],
            "source_type": SOURCE_TYPE,
        }),
        "source_type": SOURCE_TYPE,
    })

    _clear_existing_embeddings(supabase_url, supabase_key, registry_id)

    chunks = _simple_chunk(full_text, f"closure-{gap_id}", registry_id)
    if not chunks:
        return {"status": "skipped", "reason": "No chunks"}

    texts = [c["chunk_text"] for c in chunks]
    embeddings = _embed_texts(texts)

    records = [
        {
            "id": c["chunk_id"],
            "content_registry_id": c["content_registry_id"],
            "chunk_text": c["chunk_text"][:10000],
            "chunk_index": c["chunk_index"],
            "embedding": str(emb),
            "metadata": json.dumps({
                "source_type": SOURCE_TYPE,
                "gap_id": gap_id,
                "skills": vault_draft.get("display_skills", []) if vault_draft else [],
            }),
            "source_type": SOURCE_TYPE,
        }
        for c, emb in zip(chunks, embeddings)
    ]

    success = _store_embedding_records(supabase_url, supabase_key, records)

    return {
        "status": "success" if success else "partial_failure",
        "gap_id": gap_id,
        "chunks_embedded": len(records),
    }
