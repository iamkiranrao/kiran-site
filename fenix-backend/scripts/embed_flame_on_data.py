"""
Flame On Embedding Pipeline — Chunks and embeds working-process data for Fenix's Flame On mode.

This script reads Fenix Journal data (diary entries, connecting threads, product guides)
and creates embeddings with source_type='flame_on' in the content_embeddings table.

These embeddings are ONLY returned when a user has Flame On mode toggled ON.
Published site content retains source_type='published' and is used when Flame On is OFF.

Usage:
    python scripts/embed_flame_on_data.py \
        --journal-root /path/to/fenix-journal \
        --supabase-url $SUPABASE_URL \
        --supabase-key $SUPABASE_SERVICE_KEY \
        --voyage-key $VOYAGE_API_KEY

    Add --dry-run to preview chunks without embedding or storing.
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
import hashlib
from dataclasses import dataclass, field
from typing import Optional, List

try:
    import httpx
except ImportError:
    print("Installing httpx...", file=sys.stderr)
    os.system(f"{sys.executable} -m pip install httpx --quiet")
    import httpx


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

CHUNK_TARGET_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50
EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512
CHARS_PER_TOKEN = 4
SOURCE_TYPE = "flame_on"

# Content types for flame_on data
CONTENT_TYPES = {
    "about-kiran": "journal_about_kiran",
    "build-journey": "journal_build_journey",
    "connecting-threads": "journal_connecting_threads",
    "guides": "product_guide",
}


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

@dataclass
class FlameOnChunk:
    """A chunk of Flame On content ready for embedding."""
    chunk_id: str
    content_id: str
    chunk_text: str
    chunk_index: int
    section_heading: str
    content_type: str
    title: str
    source_path: str
    metadata: dict = field(default_factory=dict)


# ──────────────────────────────────────────────
# Text Processing
# ──────────────────────────────────────────────

def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences."""
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(text: str, target_tokens: int = CHUNK_TARGET_TOKENS,
               overlap_tokens: int = CHUNK_OVERLAP_TOKENS) -> List[str]:
    """Split text into overlapping chunks at sentence boundaries."""
    target_chars = target_tokens * CHARS_PER_TOKEN
    overlap_chars = overlap_tokens * CHARS_PER_TOKEN

    sentences = split_into_sentences(text)
    if not sentences:
        return [text] if text.strip() else []

    chunks = []
    current_chunk = []
    current_length = 0

    for sentence in sentences:
        sentence_len = len(sentence)

        if current_length + sentence_len > target_chars and current_chunk:
            chunks.append(" ".join(current_chunk))

            # Keep overlap from the end of the current chunk
            overlap_text = ""
            overlap_sentences = []
            for s in reversed(current_chunk):
                if len(overlap_text) + len(s) > overlap_chars:
                    break
                overlap_sentences.insert(0, s)
                overlap_text = " ".join(overlap_sentences)

            current_chunk = overlap_sentences
            current_length = len(overlap_text)

        current_chunk.append(sentence)
        current_length += sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def generate_content_id(path: str) -> str:
    """Generate a deterministic UUID from the file path."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"flame_on:{path}"))


# ──────────────────────────────────────────────
# Content Discovery
# ──────────────────────────────────────────────

def discover_journal_entries(journal_root: str) -> List[dict]:
    """Find all journal entries and product guides."""
    entries = []
    entries_dir = os.path.join(journal_root, "entries")

    # Journal streams
    for stream_key, content_type in CONTENT_TYPES.items():
        if stream_key == "guides":
            continue  # Handled separately

        stream_dir = os.path.join(entries_dir, stream_key)
        if not os.path.isdir(stream_dir):
            print(f"  Skipping {stream_key} (directory not found)")
            continue

        for fname in sorted(os.listdir(stream_dir)):
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(stream_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()

            date_str = fname.replace(".md", "")
            title = _extract_title(content, default=f"{stream_key} — {date_str}")

            entries.append({
                "path": fpath,
                "content": content,
                "content_type": content_type,
                "title": title,
                "stream": stream_key,
                "date": date_str,
            })

    # Product guides
    guides_dir = os.path.join(journal_root, "guides")
    if os.path.isdir(guides_dir):
        for fname in sorted(os.listdir(guides_dir)):
            if not fname.endswith(".md") or fname.startswith("_"):
                continue
            fpath = os.path.join(guides_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()

            title = _extract_title(content, default=fname.replace(".md", "").replace("-", " ").title())

            entries.append({
                "path": fpath,
                "content": content,
                "content_type": "product_guide",
                "title": title,
                "stream": "guides",
                "date": None,
            })

    return entries


def _extract_title(content: str, default: str = "") -> str:
    """Extract title from markdown frontmatter or first heading."""
    # Try frontmatter
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            for line in content[3:end].split("\n"):
                if line.strip().startswith("title:"):
                    return line.split(":", 1)[1].strip()

    # Try first heading
    for line in content.split("\n"):
        if line.startswith("# "):
            return line[2:].strip()

    return default


def _strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter from markdown content."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            return content[end + 3:].strip()
    return content


# ──────────────────────────────────────────────
# Chunking Pipeline
# ──────────────────────────────────────────────

def process_entry(entry: dict) -> List[FlameOnChunk]:
    """Convert a journal entry or guide into chunks."""
    content = _strip_frontmatter(entry["content"])
    content_id = generate_content_id(entry["path"])

    # Split by sections (## headings)
    sections = re.split(r'\n(?=## )', content)

    all_chunks = []
    chunk_index = 0

    for section in sections:
        lines = section.strip().split("\n")
        heading = ""
        body = section

        if lines and lines[0].startswith("## "):
            heading = lines[0][3:].strip()
            body = "\n".join(lines[1:]).strip()

        if not body or len(body) < 50:
            continue

        # Prefix chunk with context
        prefix = f"Source: {entry['title']}"
        if heading:
            prefix += f". Section: {heading}"
        if entry.get("date"):
            prefix += f". Date: {entry['date']}"
        prefix += ".\n\n"

        text_chunks = chunk_text(body)

        for chunk_text_content in text_chunks:
            all_chunks.append(FlameOnChunk(
                chunk_id=str(uuid.uuid4()),
                content_id=content_id,
                chunk_text=prefix + chunk_text_content,
                chunk_index=chunk_index,
                section_heading=heading,
                content_type=entry["content_type"],
                title=entry["title"],
                source_path=entry["path"],
                metadata={
                    "stream": entry.get("stream", ""),
                    "date": entry.get("date", ""),
                    "heading": heading,
                    "source_type": SOURCE_TYPE,
                },
            ))
            chunk_index += 1

    return all_chunks


# ──────────────────────────────────────────────
# Embedding Generation
# ──────────────────────────────────────────────

def embed_batch_voyage(texts: List[str], voyage_key: str) -> List[List[float]]:
    """Embed a batch of texts using Voyage AI."""
    response = httpx.post(
        "https://api.voyageai.com/v1/embeddings",
        json={
            "model": EMBEDDING_MODEL,
            "input": texts,
            "input_type": "document",
        },
        headers={
            "Authorization": f"Bearer {voyage_key}",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()["data"]
    return [d["embedding"] for d in sorted(data, key=lambda x: x["index"])]


def embed_batch_fallback(texts: List[str]) -> List[List[float]]:
    """Hash-based pseudo-embedding for development."""
    embeddings = []
    for text in texts:
        text_hash = hashlib.sha512(text.encode()).hexdigest()
        embedding = []
        for j in range(0, min(len(text_hash), EMBEDDING_DIMENSIONS * 2), 2):
            byte_val = int(text_hash[j:j + 2], 16)
            embedding.append((byte_val - 128) / 128.0)
        while len(embedding) < EMBEDDING_DIMENSIONS:
            embedding.append(0.0)
        embeddings.append(embedding[:EMBEDDING_DIMENSIONS])
    return embeddings


# ──────────────────────────────────────────────
# Storage
# ──────────────────────────────────────────────

def store_content_registry(entries: List[dict], supabase_url: str, supabase_key: str):
    """Upsert content registry records for flame_on content."""
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    for entry in entries:
        content_id = generate_content_id(entry["path"])
        record = {
            "id": content_id,
            "content_type": entry["content_type"],
            "title": entry["title"],
            "url": entry.get("path", ""),
            "raw_text": entry["content"][:50000],
            "metadata": json.dumps({
                "stream": entry.get("stream", ""),
                "date": entry.get("date", ""),
                "source_type": SOURCE_TYPE,
            }),
            "source_type": SOURCE_TYPE,
        }

        response = httpx.post(
            f"{supabase_url}/rest/v1/content_registry?on_conflict=id",
            json=record,
            headers=headers,
            timeout=15,
        )
        if response.status_code not in (200, 201):
            print(f"  Warning: Failed to upsert content_registry for {entry['title']}: {response.status_code}")


def store_embeddings(
    chunks: List[FlameOnChunk],
    embeddings: List[List[float]],
    supabase_url: str,
    supabase_key: str,
):
    """Store chunk embeddings in content_embeddings with source_type='flame_on'."""
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    # First, clear existing flame_on embeddings for the content IDs we're updating
    content_ids = list(set(c.content_id for c in chunks))
    for cid in content_ids:
        httpx.delete(
            f"{supabase_url}/rest/v1/content_embeddings?content_registry_id=eq.{cid}&source_type=eq.flame_on",
            headers=headers,
            timeout=15,
        )

    # Batch insert
    batch_size = 20
    total = len(chunks)
    inserted = 0

    for i in range(0, total, batch_size):
        batch_chunks = chunks[i:i + batch_size]
        batch_embeddings = embeddings[i:i + batch_size]

        records = []
        for chunk, embedding in zip(batch_chunks, batch_embeddings):
            records.append({
                "id": chunk.chunk_id,
                "content_registry_id": chunk.content_id,
                "chunk_text": chunk.chunk_text,
                "chunk_index": chunk.chunk_index,
                "embedding": str(embedding),
                "metadata": json.dumps(chunk.metadata),
                "source_type": SOURCE_TYPE,
            })

        response = httpx.post(
            f"{supabase_url}/rest/v1/content_embeddings",
            json=records,
            headers=headers,
            timeout=30,
        )

        if response.status_code in (200, 201):
            inserted += len(records)
            print(f"  Stored batch {i // batch_size + 1} ({inserted}/{total} chunks)")
        else:
            print(f"  Error storing batch: {response.status_code} — {response.text[:200]}")

    return inserted


# ──────────────────────────────────────────────
# Main Pipeline
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Embed Flame On data for Fenix")
    parser.add_argument("--journal-root", required=True, help="Path to fenix-journal directory")
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL"), help="Supabase project URL")
    parser.add_argument("--supabase-key", default=os.environ.get("SUPABASE_SERVICE_KEY"), help="Supabase service key")
    parser.add_argument("--voyage-key", default=os.environ.get("VOYAGE_API_KEY"), help="Voyage AI API key")
    parser.add_argument("--dry-run", action="store_true", help="Preview chunks without embedding")
    args = parser.parse_args()

    if not args.dry_run:
        if not args.supabase_url or not args.supabase_key:
            print("Error: --supabase-url and --supabase-key required (or set SUPABASE_URL, SUPABASE_SERVICE_KEY)")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"Flame On Embedding Pipeline")
    print(f"Journal root: {args.journal_root}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"{'='*60}\n")

    # Step 1: Discover content
    print("Step 1: Discovering journal entries and guides...")
    entries = discover_journal_entries(args.journal_root)
    print(f"  Found {len(entries)} files to process")

    by_type = {}
    for e in entries:
        by_type.setdefault(e["content_type"], []).append(e)
    for ct, files in sorted(by_type.items()):
        print(f"    {ct}: {len(files)} files")

    # Step 2: Chunk all content
    print("\nStep 2: Chunking content...")
    all_chunks = []
    for entry in entries:
        chunks = process_entry(entry)
        all_chunks.extend(chunks)
        if chunks:
            print(f"  {entry['title'][:60]:.<60} {len(chunks)} chunks")

    print(f"\n  Total: {len(all_chunks)} chunks from {len(entries)} files")

    if args.dry_run:
        print("\n--- DRY RUN: Sample chunks ---")
        for chunk in all_chunks[:5]:
            print(f"\n[{chunk.content_type}] {chunk.title} (chunk {chunk.chunk_index})")
            print(f"  {chunk.chunk_text[:200]}...")
        print(f"\n{'='*60}")
        print(f"DRY RUN COMPLETE: {len(all_chunks)} chunks would be embedded")
        return

    # Step 3: Store content registry
    print("\nStep 3: Upserting content registry...")
    store_content_registry(entries, args.supabase_url, args.supabase_key)
    print(f"  Registered {len(entries)} content items")

    # Step 4: Generate embeddings
    print("\nStep 4: Generating embeddings...")
    texts = [c.chunk_text for c in all_chunks]
    all_embeddings = []

    batch_size = 2  # Small batches to stay under Voyage free-tier rate limits
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        max_retries = 5
        for attempt in range(max_retries):
            try:
                if args.voyage_key:
                    embeddings = embed_batch_voyage(batch, args.voyage_key)
                else:
                    print("  Warning: No Voyage API key — using hash fallback (poor quality)")
                    embeddings = embed_batch_fallback(batch)
                all_embeddings.extend(embeddings)
                print(f"  Embedded {min(i + batch_size, len(texts))}/{len(texts)}")
                break
            except Exception as e:
                wait_time = (attempt + 1) * 10  # 10s, 20s, 30s, 40s, 50s backoff
                if attempt < max_retries - 1:
                    print(f"  Rate limited, waiting {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    print(f"  FATAL after {max_retries} retries: {e}")
                    sys.exit(1)

        # Rate limit courtesy delay — 3s between batches
        if args.voyage_key and i + batch_size < len(texts):
            time.sleep(3)

    # Step 5: Store embeddings
    print(f"\nStep 5: Storing {len(all_chunks)} embeddings...")
    inserted = store_embeddings(all_chunks, all_embeddings, args.supabase_url, args.supabase_key)

    print(f"\n{'='*60}")
    print(f"DONE: {inserted} flame_on embeddings stored")
    print(f"  Content types: {', '.join(sorted(by_type.keys()))}")
    print(f"  Source type: {SOURCE_TYPE}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
