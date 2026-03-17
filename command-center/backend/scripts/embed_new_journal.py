"""
Incremental Flame On Embedding Script

Discovers all journal content, checks what's already embedded in Supabase,
and only embeds new/missing chunks. Designed to run daily after process_journal.py.

Uses Voyage AI free tier with aggressive rate limiting to stay within bounds.
"""

import sys
import json
import time
import os
import logging
from pathlib import Path

# Add fenix-backend scripts to path for shared chunking logic
FENIX_BACKEND = Path(__file__).resolve().parent.parent.parent.parent / "fenix-backend" / "scripts"
sys.path.insert(0, str(FENIX_BACKEND))

from embed_flame_on_data import discover_journal_entries, process_entry, store_content_registry

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("embed_journal")

# ── Config ─────────────────────────────────────────────────────────

def load_env():
    """Load environment variables from .env file."""
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                val = val.strip().strip('"')
                if key not in os.environ:
                    os.environ[key] = val

load_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
VOYAGE_KEY = os.environ.get("VOYAGE_API_KEY", "")
JOURNAL_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "fenix-journal"

if not all([SUPABASE_URL, SUPABASE_KEY, VOYAGE_KEY]):
    logger.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, VOYAGE_API_KEY")
    sys.exit(1)

try:
    import httpx
except ImportError:
    logger.error("httpx not installed. Run: pip install httpx")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def get_existing_ids() -> set:
    """Get IDs of already-embedded chunks."""
    try:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/content_embeddings?source_type=eq.flame_on&select=id",
            headers=HEADERS,
            timeout=15,
        )
        return {item["id"] for item in r.json()}
    except Exception as e:
        logger.warning(f"Could not fetch existing IDs: {e}")
        return set()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts via Voyage AI with retries."""
    for attempt in range(8):
        try:
            resp = httpx.post(
                "https://api.voyageai.com/v1/embeddings",
                json={"input": texts, "model": "voyage-3-lite"},
                headers={
                    "Authorization": f"Bearer {VOYAGE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            resp.raise_for_status()
            return [d["embedding"] for d in resp.json()["data"]]
        except Exception as e:
            wait = 20 + attempt * 15
            logger.warning(f"Voyage API error (attempt {attempt+1}/8): {e}. Waiting {wait}s...")
            if attempt < 7:
                time.sleep(wait)
            else:
                raise


def store_embeddings(records: list[dict]):
    """Store embedding records in Supabase."""
    resp = httpx.post(
        f"{SUPABASE_URL}/rest/v1/content_embeddings",
        json=records,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        logger.error(f"Supabase store failed: {resp.status_code} {resp.text[:200]}")
        return False
    return True


def run():
    """Main embedding run."""
    # Discover all journal content
    entries = discover_journal_entries(str(JOURNAL_ROOT))
    if not entries:
        logger.info("No journal entries found.")
        return {"status": "skipped", "reason": "no entries"}

    # Chunk everything
    all_chunks = []
    for e in entries:
        all_chunks.extend(process_entry(e))
    logger.info(f"Total chunks: {len(all_chunks)}")

    # Ensure all entries are registered in content_registry (foreign key requirement)
    logger.info(f"Registering {len(entries)} entries in content_registry...")
    store_content_registry(entries, SUPABASE_URL, SUPABASE_KEY)

    # Filter to only new chunks
    existing = get_existing_ids()
    remaining = [c for c in all_chunks if c.chunk_id not in existing]
    logger.info(f"Already embedded: {len(existing)}, New to embed: {len(remaining)}")

    if not remaining:
        logger.info("All chunks already embedded. Nothing to do.")
        return {"status": "up_to_date", "total": len(all_chunks), "existing": len(existing)}

    # Process in batches of 2 with 30s delay (Voyage free tier safe)
    stored = 0
    batch_size = 2

    for i in range(0, len(remaining), batch_size):
        batch = remaining[i : i + batch_size]
        texts = [c.chunk_text for c in batch]

        try:
            embeddings = embed_batch(texts)
        except Exception as e:
            logger.error(f"Failed to embed batch at index {i}: {e}")
            break

        records = [
            {
                "id": c.chunk_id,
                "content_registry_id": c.content_id,
                "chunk_text": c.chunk_text,
                "chunk_index": c.chunk_index,
                "embedding": str(emb),
                "metadata": json.dumps(c.metadata),
                "source_type": "flame_on",
            }
            for c, emb in zip(batch, embeddings)
        ]

        if store_embeddings(records):
            stored += len(records)
            logger.info(f"Progress: {stored}/{len(remaining)} new chunks stored")
        else:
            logger.error(f"Storage failed at batch {i}")

        # Rate limit delay (skip after last batch)
        if i + batch_size < len(remaining):
            time.sleep(30)

    logger.info(f"DONE: {stored} new embeddings stored out of {len(remaining)} needed")
    return {
        "status": "success",
        "total_chunks": len(all_chunks),
        "previously_embedded": len(existing),
        "newly_embedded": stored,
        "remaining": len(remaining) - stored,
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2))
