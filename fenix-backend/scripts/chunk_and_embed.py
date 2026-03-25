"""
Chunking + Embedding Pipeline — Step 4.2
Takes extracted content → splits into semantic chunks → generates embeddings → stores in Supabase pgvector.

Usage:
    python scripts/chunk_and_embed.py --input extracted_content.json --supabase-url $SUPABASE_URL --supabase-key $SUPABASE_SERVICE_KEY --anthropic-key $ANTHROPIC_API_KEY

What embeddings are:
    An embedding converts text into a list of numbers (a vector) that captures its meaning.
    "Mobile banking app" and "smartphone financial application" have different words but nearly identical embeddings.
    This is how Fenix finds relevant content even when the visitor's question doesn't match the exact words on the pages.
"""

import argparse
import json
import os
import sys
import time
import uuid
import hashlib
from dataclasses import dataclass, field
from typing import Optional

try:
    import httpx
except ImportError:
    print("Installing httpx...", file=sys.stderr)
    os.system(f"{sys.executable} -m pip install httpx --quiet")
    import httpx


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

# Voyage AI (Anthropic's recommended embedding model) or fallback to a simple approach
# For now we use Voyage AI's voyage-3-lite (512 dimensions, good quality/cost ratio)
# If no Voyage key, we fall back to Anthropic's Claude for embedding-like summaries
CHUNK_TARGET_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50
EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512

# Rough token estimation: ~4 chars per token for English
CHARS_PER_TOKEN = 4


# ──────────────────────────────────────────────
# Chunking
# ──────────────────────────────────────────────

@dataclass
class Chunk:
    """A semantic chunk of content."""
    chunk_id: str
    content_id: str          # FK to content_registry
    chunk_text: str
    chunk_index: int
    section_heading: str     # Which section this chunk came from
    content_type: str
    url: str
    canonical_url: str       # Full canonical URL for FK matching
    title: str
    metadata: dict = field(default_factory=dict)

    @property
    def estimated_tokens(self) -> int:
        return len(self.chunk_text) // CHARS_PER_TOKEN


def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences (simple but effective)."""
    import re
    # Split on sentence boundaries but keep the delimiter
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(text: str, target_tokens: int = CHUNK_TARGET_TOKENS,
               overlap_tokens: int = CHUNK_OVERLAP_TOKENS) -> list[str]:
    """
    Split text into overlapping chunks of ~target_tokens each.
    Uses sentence boundaries to avoid cutting mid-sentence.
    Overlaps by ~overlap_tokens to preserve context at boundaries.
    """
    if not text.strip():
        return []

    target_chars = target_tokens * CHARS_PER_TOKEN
    overlap_chars = overlap_tokens * CHARS_PER_TOKEN

    sentences = split_into_sentences(text)
    if not sentences:
        return [text] if text.strip() else []

    chunks = []
    current_chunk: list[str] = []
    current_length = 0

    for sentence in sentences:
        sentence_len = len(sentence)

        # If a single sentence exceeds target, it becomes its own chunk
        if sentence_len > target_chars * 1.5:
            if current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = []
                current_length = 0
            chunks.append(sentence)
            continue

        # If adding this sentence exceeds target, start new chunk with overlap
        if current_length + sentence_len > target_chars and current_chunk:
            chunks.append(" ".join(current_chunk))

            # Calculate overlap: keep last N chars worth of sentences
            overlap_chunk: list[str] = []
            overlap_len = 0
            for s in reversed(current_chunk):
                if overlap_len + len(s) > overlap_chars:
                    break
                overlap_chunk.insert(0, s)
                overlap_len += len(s)

            current_chunk = overlap_chunk
            current_length = overlap_len

        current_chunk.append(sentence)
        current_length += sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def chunk_page(page: dict) -> list[Chunk]:
    """
    Chunk a single extracted page into semantic chunks.
    Strategy: if sections exist, chunk within sections (preserving context).
    Otherwise, chunk the full raw text.
    """
    content_id = page["id"]
    content_type = page["content_type"]
    url = page["url"]
    canonical_url = page.get("canonical_url", f"https://kiranrao.ai{url}")
    title = page["title"]

    chunks = []
    chunk_index = 0

    # Build section-aware text blocks
    sections = page.get("sections", [])
    if sections and len(sections) > 1:
        for section in sections:
            heading = section.get("heading", "")
            text = section.get("text", "")
            if not text.strip():
                continue

            # Prefix chunk with context
            context_prefix = f"Page: {title}. Section: {heading}.\n\n"
            section_chunks = chunk_text(text)

            for chunk_text_str in section_chunks:
                chunks.append(Chunk(
                    chunk_id=str(uuid.uuid4()),
                    content_id=content_id,
                    chunk_text=context_prefix + chunk_text_str,
                    chunk_index=chunk_index,
                    section_heading=heading,
                    content_type=content_type,
                    url=url,
                    canonical_url=canonical_url,
                    title=title,
                    metadata={
                        "skills": page.get("skills", []),
                        "themes": page.get("themes", []),
                        "industry": page.get("industry", ""),
                        "company": page.get("company", ""),
                    }
                ))
                chunk_index += 1
    else:
        # No sections — chunk the full text
        raw_text = page.get("raw_text", "")
        if not raw_text.strip():
            return []

        context_prefix = f"Page: {title}.\n\n"
        text_chunks = chunk_text(raw_text)

        for chunk_text_str in text_chunks:
            chunks.append(Chunk(
                chunk_id=str(uuid.uuid4()),
                content_id=content_id,
                chunk_text=context_prefix + chunk_text_str,
                chunk_index=chunk_index,
                section_heading="",
                content_type=content_type,
                url=url,
                canonical_url=canonical_url,
                title=title,
                metadata={
                    "skills": page.get("skills", []),
                    "themes": page.get("themes", []),
                    "industry": page.get("industry", ""),
                    "company": page.get("company", ""),
                }
            ))
            chunk_index += 1

    # Always add a summary chunk if we have one (high-value for RAG)
    summary = page.get("summary", "")
    if summary:
        summary_text = (
            f"Page: {title}.\n"
            f"Type: {content_type}.\n"
            f"URL: https://kiranrao.ai{url}\n\n"
            f"Summary: {summary}"
        )
        if page.get("skills"):
            summary_text += f"\nSkills demonstrated: {', '.join(page['skills'])}"
        if page.get("themes"):
            summary_text += f"\nThemes: {', '.join(page['themes'])}"

        chunks.append(Chunk(
            chunk_id=str(uuid.uuid4()),
            content_id=content_id,
            chunk_text=summary_text,
            chunk_index=chunk_index,
            section_heading="_summary",
            content_type=content_type,
            url=url,
            canonical_url=canonical_url,
            title=title,
            metadata={
                "skills": page.get("skills", []),
                "themes": page.get("themes", []),
                "industry": page.get("industry", ""),
                "company": page.get("company", ""),
                "is_summary": True,
            }
        ))

    return chunks


# ──────────────────────────────────────────────
# Embedding Generation (Voyage AI)
# ──────────────────────────────────────────────

def generate_embeddings_voyage(texts: list[str], api_key: str,
                                model: str = EMBEDDING_MODEL) -> list[list[float]]:
    """
    Generate embeddings using Voyage AI API.
    Batches texts (max 128 per request, max 120K tokens per request).
    """
    url = "https://api.voyageai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    all_embeddings = []
    batch_size = 4  # Very small batches for free-tier rate limits

    total_batches = (len(texts) + batch_size - 1) // batch_size
    print(f"  {total_batches} batches total (~{total_batches * 25}s estimated)", file=sys.stderr)

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch_num = (i // batch_size) + 1
        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} texts)...", file=sys.stderr, end=" ", flush=True)

        payload = {
            "model": model,
            "input": batch,
            "input_type": "document",  # Optimized for document retrieval
        }

        # Retry with exponential backoff for rate limits and timeouts
        max_retries = 8
        for attempt in range(max_retries):
            try:
                response = httpx.post(url, json=payload, headers=headers, timeout=120)
            except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.WriteTimeout):
                wait_time = min(60, 5 * (attempt + 1))
                print(f"timeout, wait {wait_time}s...", file=sys.stderr, end=" ", flush=True)
                time.sleep(wait_time)
                continue
            if response.status_code == 429:
                wait_time = min(90, 10 * (attempt + 1))  # 10, 20, 30, 40, 50, 60, 70, 80
                print(f"rate limit, wait {wait_time}s...", file=sys.stderr, end=" ", flush=True)
                time.sleep(wait_time)
                continue
            response.raise_for_status()
            break
        else:
            raise Exception(f"Failed after {max_retries} retries on batch {batch_num}")

        result = response.json()
        batch_embeddings = [item["embedding"] for item in result["data"]]
        all_embeddings.extend(batch_embeddings)
        print("OK", file=sys.stderr, flush=True)

        if i + batch_size < len(texts):
            time.sleep(20)  # 20s between batches for free-tier rate limits

    return all_embeddings


def generate_embeddings_anthropic_fallback(texts: list[str], api_key: str) -> list[list[float]]:
    """
    Fallback: use a simple hash-based embedding for development/testing.
    NOT for production — replace with Voyage AI or another embedding model.
    This produces deterministic 1024-dim vectors from text content.
    """
    print("  [WARN] Using hash-based fallback embeddings (not for production!)", file=sys.stderr)
    embeddings = []
    for text in texts:
        # Create a deterministic pseudo-embedding from text hash
        text_hash = hashlib.sha512(text.encode()).hexdigest()
        # Convert hex to floats between -1 and 1
        embedding = []
        for j in range(0, min(len(text_hash), EMBEDDING_DIMENSIONS * 2), 2):
            byte_val = int(text_hash[j:j+2], 16)
            embedding.append((byte_val - 128) / 128.0)
        # Pad if needed
        while len(embedding) < EMBEDDING_DIMENSIONS:
            embedding.append(0.0)
        embedding = embedding[:EMBEDDING_DIMENSIONS]
        embeddings.append(embedding)
    return embeddings


# ──────────────────────────────────────────────
# Supabase Storage
# ──────────────────────────────────────────────

def store_content_registry(supabase_url: str, supabase_key: str, pages: list[dict]):
    """Upsert pages into content_registry table."""
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    for page in pages:
        record = {
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, page["canonical_url"])),
            "content_type": page["content_type"],
            "title": page["title"],
            "url": page["url"],
            "raw_text": page["raw_text"][:50000],  # Truncate very long pages
            "metadata": json.dumps({
                "skills": page.get("skills", []),
                "themes": page.get("themes", []),
                "industry": page.get("industry", ""),
                "company": page.get("company", ""),
                "summary": page.get("summary", ""),
                "connections": page.get("connections", []),
                "description": page.get("description", ""),
                "og_image": page.get("og_image", ""),
                "word_count": page.get("word_count", 0),
                "read_time_minutes": page.get("read_time_minutes", 0),
            }),
            "published_at": page.get("published_date") or None,
        }

        resp = httpx.post(
            f"{supabase_url}/rest/v1/content_registry",
            json=record,
            headers=headers,
            timeout=30,
        )
        if resp.status_code in (200, 201):
            print(f"  [DB] Stored: {page['title']}", file=sys.stderr)
        elif resp.status_code == 409:
            # Conflict — try upsert
            resp2 = httpx.post(
                f"{supabase_url}/rest/v1/content_registry?on_conflict=id",
                json=record,
                headers={**headers, "Prefer": "resolution=merge-duplicates"},
                timeout=30,
            )
            if resp2.status_code in (200, 201):
                print(f"  [DB] Updated: {page['title']}", file=sys.stderr)
            else:
                print(f"  [WARN] Failed to upsert {page['title']}: {resp2.status_code} {resp2.text}", file=sys.stderr)
        else:
            print(f"  [WARN] Failed to store {page['title']}: {resp.status_code} {resp.text}", file=sys.stderr)


def store_embeddings(supabase_url: str, supabase_key: str,
                     chunks: list[Chunk], embeddings: list[list[float]]):
    """Store chunk embeddings in content_embeddings table."""
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # First, clear existing embeddings (full re-index)
    print("  [DB] Clearing existing embeddings...", file=sys.stderr)
    httpx.delete(
        f"{supabase_url}/rest/v1/content_embeddings?id=neq.00000000-0000-0000-0000-000000000000",
        headers=headers,
        timeout=30,
    )

    # Insert new embeddings in batches
    batch_size = 20
    stored = 0
    errors = 0

    for i in range(0, len(chunks), batch_size):
        batch_chunks = chunks[i : i + batch_size]
        batch_embeddings = embeddings[i : i + batch_size]

        records = []
        for chunk, embedding in zip(batch_chunks, batch_embeddings):
            content_registry_id = str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                chunk.canonical_url
            ))

            records.append({
                "id": chunk.chunk_id,
                "content_registry_id": content_registry_id,
                "chunk_text": chunk.chunk_text[:10000],
                "chunk_index": chunk.chunk_index,
                "embedding": embedding,
                "metadata": json.dumps(chunk.metadata),
            })

        resp = httpx.post(
            f"{supabase_url}/rest/v1/content_embeddings",
            json=records,
            headers=headers,
            timeout=60,
        )
        if resp.status_code in (200, 201):
            stored += len(records)
        else:
            errors += len(records)
            print(f"  [WARN] Batch insert failed: {resp.status_code} {resp.text[:200]}", file=sys.stderr)

    print(f"  [DB] Embeddings stored: {stored}, errors: {errors}", file=sys.stderr)


# ──────────────────────────────────────────────
# Main Pipeline
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Chunk content and generate embeddings")
    parser.add_argument("--input", required=True, help="Path to extracted_content.json")
    parser.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL"))
    parser.add_argument("--supabase-key", default=os.environ.get("SUPABASE_SERVICE_KEY"))
    parser.add_argument("--voyage-key", default=os.environ.get("VOYAGE_API_KEY"))
    parser.add_argument("--dry-run", action="store_true", help="Don't store in database")
    args = parser.parse_args()

    # Load extracted content
    with open(args.input) as f:
        data = json.load(f)

    pages = data["pages"]
    print(f"\nChunking + Embedding Pipeline", file=sys.stderr)
    print(f"Pages to process: {len(pages)}\n", file=sys.stderr)

    # Step 1: Chunk all pages
    all_chunks: list[Chunk] = []
    for page in pages:
        page_chunks = chunk_page(page)
        all_chunks.extend(page_chunks)
        print(f"  [CHUNK] {page['title']}: {len(page_chunks)} chunks", file=sys.stderr)

    print(f"\nTotal chunks: {len(all_chunks)}", file=sys.stderr)
    total_tokens = sum(c.estimated_tokens for c in all_chunks)
    print(f"Estimated total tokens: {total_tokens:,}", file=sys.stderr)

    # Step 2: Generate embeddings
    print(f"\nGenerating embeddings...", file=sys.stderr)
    texts = [c.chunk_text for c in all_chunks]

    if args.voyage_key:
        print(f"  Using Voyage AI ({EMBEDDING_MODEL})", file=sys.stderr)
        embeddings = generate_embeddings_voyage(texts, args.voyage_key)
    else:
        print(f"  No VOYAGE_API_KEY — using fallback embeddings", file=sys.stderr)
        embeddings = generate_embeddings_anthropic_fallback(texts, "")

    print(f"  Generated {len(embeddings)} embeddings ({EMBEDDING_DIMENSIONS} dimensions each)", file=sys.stderr)

    # Step 3: Store in Supabase
    if not args.dry_run and args.supabase_url and args.supabase_key:
        print(f"\nStoring in Supabase...", file=sys.stderr)
        store_content_registry(args.supabase_url, args.supabase_key, pages)
        store_embeddings(args.supabase_url, args.supabase_key, all_chunks, embeddings)
    elif args.dry_run:
        print(f"\n[DRY RUN] Would store {len(pages)} content records and {len(all_chunks)} embeddings", file=sys.stderr)
    else:
        print(f"\n[SKIP] No Supabase credentials — skipping database storage", file=sys.stderr)

    # Output summary
    print(f"\n--- Pipeline Complete ---", file=sys.stderr)
    print(f"Pages: {len(pages)}", file=sys.stderr)
    print(f"Chunks: {len(all_chunks)}", file=sys.stderr)
    print(f"Embeddings: {len(embeddings)}", file=sys.stderr)
    print(f"Dimensions: {EMBEDDING_DIMENSIONS}", file=sys.stderr)

    # Output chunk manifest for debugging
    manifest = {
        "chunk_count": len(all_chunks),
        "embedding_model": EMBEDDING_MODEL if args.voyage_key else "hash-fallback",
        "dimensions": EMBEDDING_DIMENSIONS,
        "chunks": [
            {
                "id": c.chunk_id,
                "content_id": c.content_id,
                "title": c.title,
                "section": c.section_heading,
                "tokens": c.estimated_tokens,
                "text_preview": c.chunk_text[:200] + "..." if len(c.chunk_text) > 200 else c.chunk_text,
            }
            for c in all_chunks
        ]
    }
    json.dump(manifest, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
