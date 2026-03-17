#!/usr/bin/env python3
"""
Embed Training Data — Generate vector embeddings for all training_data entries.

Usage:
    python scripts/embed_training_data.py

Requires env vars:
    SUPABASE_URL, SUPABASE_SERVICE_KEY, VOYAGE_API_KEY

This script:
  1. Fetches all active training_data rows missing embeddings
  2. Generates embeddings via Voyage AI (voyage-3-lite, 512 dims)
  3. Updates each row's embedding column in Supabase
  4. Handles rate limiting with backoff (free-tier friendly)
"""

import os
import sys
import time
import json
import hashlib
import httpx
from pathlib import Path
from dotenv import load_dotenv

# Load env from fenix-backend root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
VOYAGE_KEY = os.getenv("VOYAGE_API_KEY", "").strip()

EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512
BATCH_SIZE = 4  # Free-tier safe
BETWEEN_BATCH_WAIT = 20  # seconds


def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_training_entries_without_embeddings():
    """Fetch all active training entries that don't have embeddings yet."""
    headers = get_supabase_headers()
    response = httpx.get(
        f"{SUPABASE_URL}/rest/v1/training_data"
        "?status=eq.active&embedding=is.null"
        "&select=id,question,answer,category",
        headers=headers,
        timeout=30,
    )
    if response.status_code != 200:
        print(f"[ERROR] Failed to fetch training data: {response.status_code} {response.text[:200]}")
        sys.exit(1)
    return response.json()


def embed_texts_voyage(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts using Voyage AI."""
    response = httpx.post(
        "https://api.voyageai.com/v1/embeddings",
        json={
            "model": EMBEDDING_MODEL,
            "input": texts,
            "input_type": "document",
        },
        headers={
            "Authorization": f"Bearer {VOYAGE_KEY}",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return [item["embedding"] for item in data["data"]]


def embed_text_fallback(text: str) -> list[float]:
    """Hash-based pseudo-embedding fallback (matches rag_service.py)."""
    text_hash = hashlib.sha512(text.encode()).hexdigest()
    embedding = []
    for j in range(0, min(len(text_hash), EMBEDDING_DIMENSIONS * 2), 2):
        byte_val = int(text_hash[j : j + 2], 16)
        embedding.append((byte_val - 128) / 128.0)
    while len(embedding) < EMBEDDING_DIMENSIONS:
        embedding.append(0.0)
    return embedding[:EMBEDDING_DIMENSIONS]


def update_embedding(entry_id: str, embedding: list[float]):
    """Update a training_data row with its embedding."""
    headers = get_supabase_headers()
    headers["Prefer"] = "return=minimal"

    response = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/training_data?id=eq.{entry_id}",
        json={"embedding": str(embedding)},
        headers=headers,
        timeout=30,
    )
    if response.status_code not in (200, 204):
        print(f"  [WARN] Failed to update {entry_id}: {response.status_code} {response.text[:100]}")
        return False
    return True


def format_training_text(entry: dict) -> str:
    """Format Q&A pair for embedding. Combines question + answer for richer semantics."""
    q = entry.get("question", "")
    a = entry.get("answer", "")
    cat = entry.get("category", "")
    cat_label = f" [Category: {cat}]" if cat else ""
    return f"Q: {q}\nA: {a}{cat_label}"


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[FATAL] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")
        sys.exit(1)

    use_voyage = bool(VOYAGE_KEY)
    if not use_voyage:
        print("[WARN] VOYAGE_API_KEY not set — using hash fallback (not suitable for production)")

    # Fetch entries
    entries = fetch_training_entries_without_embeddings()
    total = len(entries)
    print(f"\nFound {total} training entries without embeddings.\n")

    if total == 0:
        print("Nothing to do — all entries already have embeddings.")
        return

    # Process in batches
    success = 0
    errors = 0

    for i in range(0, total, BATCH_SIZE):
        batch = entries[i : i + BATCH_SIZE]
        texts = [format_training_text(e) for e in batch]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

        print(f"Batch {batch_num}/{total_batches} ({len(batch)} entries)...")

        try:
            if use_voyage:
                embeddings = embed_texts_voyage(texts)
            else:
                embeddings = [embed_text_fallback(t) for t in texts]

            for entry, embedding in zip(batch, embeddings):
                if update_embedding(entry["id"], embedding):
                    success += 1
                    print(f"  ✓ {entry['id'][:8]} — {entry['question'][:60]}")
                else:
                    errors += 1

        except Exception as e:
            print(f"  [ERROR] Batch failed: {e}")
            errors += len(batch)

        # Rate limit pause between batches
        if use_voyage and i + BATCH_SIZE < total:
            print(f"  Waiting {BETWEEN_BATCH_WAIT}s for rate limiting...")
            time.sleep(BETWEEN_BATCH_WAIT)

    print(f"\nDone! {success}/{total} embedded, {errors} errors.")


if __name__ == "__main__":
    main()
