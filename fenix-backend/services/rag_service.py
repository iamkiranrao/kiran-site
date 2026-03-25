"""
RAG Service — Step 4.3
Retrieval-Augmented Generation pipeline for Fenix.

Flow: User query → embed query → pgvector nearest-neighbor search → top-k chunks → augmented context for LLM.

How RAG works:
    1. User asks "What has Kiran built with AI?"
    2. We convert that question into an embedding vector
    3. We search pgvector for the most similar content chunks
    4. We return those chunks as context for the LLM to reference
    5. The LLM responds with citations to specific content

This service is imported by the Fenix chat API (Phase 5).
"""


import json
import os
import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Optional


logger = logging.getLogger("fenix.rag")


try:
    import httpx
except ImportError:
    os.system("pip install httpx --quiet --break-system-packages")
    import httpx


# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512
DEFAULT_TOP_K = 5
MAX_TOP_K = 15
SIMILARITY_THRESHOLD = 0.2  # Lowered from 0.3 to catch more edge-case matches

# Stop words to strip when extracting keyword search terms
_STOP_WORDS = frozenset(
    "what do you know about tell me has kiran built does the "
    "a an the is are was were be been being have had having "
    "i my me we our you your he she it they them this that "
    "of in to for on with at by from how who which where when".split()
)


# ──────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────

@dataclass
class RetrievedChunk:
    """A chunk retrieved from the vector store with similarity score."""
    chunk_id: str
    chunk_text: str
    chunk_index: int
    content_type: str
    title: str
    url: str
    section_heading: str
    similarity: float
    metadata: dict = field(default_factory=dict)


@dataclass
class TrainingMatch:
    """A Q&A pair from training_data matched via semantic or text search."""
    entry_id: str
    question: str
    answer: str
    category: str
    source: str
    similarity: float


@dataclass
class RAGContext:
    """
    The assembled context from RAG retrieval.
    Ready to be injected into an LLM prompt.
    """
    chunks: list[RetrievedChunk]
    query: str
    total_tokens_estimate: int
    context_text: str       # Formatted text for LLM injection
    citations: list[dict]   # Citation objects for the response
    search_type: str = "none"               # "semantic", "keyword", "none"
    similarity_scores: list[float] = field(default_factory=list)
    training_matches: list[TrainingMatch] = field(default_factory=list)


# ──────────────────────────────────────────────
# Query Embedding
# ──────────────────────────────────────────────

def embed_query_voyage(query: str, voyage_key: str) -> list[float]:
    """Generate query embedding using Voyage AI."""
    response = httpx.post(
        "https://api.voyageai.com/v1/embeddings",
        json={
            "model": EMBEDDING_MODEL,
            "input": [query],
            "input_type": "query",  # Optimized for query retrieval
        },
        headers={
            "Authorization": f"Bearer {voyage_key}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["data"][0]["embedding"]


def embed_query_fallback(query: str) -> list[float]:
    """
    Fallback: hash-based pseudo-embedding for development.
    Must match the same algorithm used in chunk_and_embed.py.
    """
    text_hash = hashlib.sha512(query.encode()).hexdigest()
    embedding = []
    for j in range(0, min(len(text_hash), EMBEDDING_DIMENSIONS * 2), 2):
        byte_val = int(text_hash[j:j+2], 16)
        embedding.append((byte_val - 128) / 128.0)
    while len(embedding) < EMBEDDING_DIMENSIONS:
        embedding.append(0.0)
    return embedding[:EMBEDDING_DIMENSIONS]


# ──────────────────────────────────────────────
# Keyword Extraction (for text-search fallback)
# ──────────────────────────────────────────────

def extract_search_terms(query: str) -> list[str]:
    """
    Pull meaningful keywords from a user query for text-based fallback search.
    Returns a list of candidate search terms, longest first.

    Examples:
        "What do you know about LangChain?" → ["langchain"]
        "Tell me about Apple Pay"           → ["apple pay"]
        "insurance chatbot prototype"       → ["insurance chatbot prototype", "insurance chatbot", "insurance", "chatbot", "prototype"]
    """
    # Normalise
    text = query.lower().strip()
    text = re.sub(r"[?!.,;:\"'()\[\]{}]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    words = text.split()
    meaningful = [w for w in words if w not in _STOP_WORDS and len(w) > 2]

    if not meaningful:
        return []

    # Build terms: full phrase first, then individual words
    terms = []
    full_phrase = " ".join(meaningful)
    if len(meaningful) > 1:
        terms.append(full_phrase)
    # Also add individual words (useful for single-keyword matches)
    terms.extend(meaningful)

    return terms


# ──────────────────────────────────────────────
# Vector Search (pgvector via Supabase RPC)
# ──────────────────────────────────────────────

def search_similar_chunks(
    query_embedding: list[float],
    supabase_url: str,
    supabase_key: str,
    top_k: int = DEFAULT_TOP_K,
    content_type_filter: Optional[str] = None,
    source_type_filter: Optional[str] = None,
    similarity_threshold: float = SIMILARITY_THRESHOLD,
) -> list[RetrievedChunk]:
    """
    Search pgvector for chunks most similar to the query embedding.
    Uses a Supabase RPC function for efficient vector similarity search.

    Args:
        source_type_filter: 'published' for curated site content,
                           'flame_on' for working-process data (journal, sessions, guides).
                           None returns all content.
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    # Use Supabase RPC for vector similarity search
    payload = {
        "query_embedding": str(query_embedding),
        "match_threshold": similarity_threshold,
        "match_count": min(top_k, MAX_TOP_K),
    }

    if content_type_filter:
        payload["filter_content_type"] = content_type_filter

    if source_type_filter:
        payload["filter_source_type"] = source_type_filter

    logger.info(f"RAG search: dims={len(query_embedding)}, first3={query_embedding[:3]}, thresh={similarity_threshold}")
    response = httpx.post(
        f"{supabase_url}/rest/v1/rpc/match_content_embeddings",
        json=payload,
        headers=headers,
        timeout=30,
    )

    if response.status_code != 200:
        logger.warning(f"RPC match_content_embeddings failed (HTTP {response.status_code}): {response.text[:200]}. Falling back to direct table query.")
        return _search_fallback(query_embedding, supabase_url, supabase_key, top_k)

    results = response.json()

    return [
        RetrievedChunk(
            chunk_id=r.get("id", ""),
            chunk_text=r.get("chunk_text", ""),
            chunk_index=r.get("chunk_index", 0),
            content_type=r.get("content_type", ""),
            title=r.get("title", ""),
            url=r.get("url", ""),
            section_heading=r.get("section_heading", ""),
            similarity=r.get("similarity", 0.0),
            metadata=json.loads(r.get("metadata", "{}")) if isinstance(r.get("metadata"), str) else r.get("metadata", {}),
        )
        for r in results
    ]


# ──────────────────────────────────────────────
# Keyword Text Search (fallback when vector search returns 0)
# ──────────────────────────────────────────────

def _keyword_search(
    query: str,
    supabase_url: str,
    supabase_key: str,
    top_k: int = DEFAULT_TOP_K,
    content_type_filter: Optional[str] = None,
    source_type_filter: Optional[str] = None,
) -> list[RetrievedChunk]:
    """
    Text-based keyword fallback search via Supabase RPC.
    Called when semantic vector search returns zero results.

    Tries each extracted search term (longest first) until results are found.
    """
    terms = extract_search_terms(query)
    if not terms:
        return []

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    for term in terms:
        payload = {
            "search_terms": term,
            "match_count": min(top_k, MAX_TOP_K),
        }
        if content_type_filter:
            payload["filter_content_type"] = content_type_filter
        if source_type_filter:
            payload["filter_source_type"] = source_type_filter

        try:
            response = httpx.post(
                f"{supabase_url}/rest/v1/rpc/keyword_search_content",
                json=payload,
                headers=headers,
                timeout=15,
            )

            if response.status_code != 200:
                logger.warning(f"Keyword search RPC failed (HTTP {response.status_code}) for term '{term}': {response.text[:200]}")
                continue

            results = response.json()
            if results:
                logger.info(f"Keyword fallback found {len(results)} chunks for term '{term}'")
                return [
                    RetrievedChunk(
                        chunk_id=r.get("id", ""),
                        chunk_text=r.get("chunk_text", ""),
                        chunk_index=r.get("chunk_index", 0),
                        content_type=r.get("content_type", ""),
                        title=r.get("title", ""),
                        url=r.get("url", ""),
                        section_heading=r.get("section_heading", ""),
                        similarity=r.get("similarity", 0.0),
                        metadata=json.loads(r.get("metadata", "{}")) if isinstance(r.get("metadata"), str) else r.get("metadata", {}),
                    )
                    for r in results
                ]
        except Exception as e:
            logger.warning(f"Keyword search failed for term '{term}': {e}")
            continue

    return []


def _search_fallback(
    query_embedding: list[float],
    supabase_url: str,
    supabase_key: str,
    top_k: int,
) -> list[RetrievedChunk]:
    """
    Fallback search using direct PostgREST query.
    Less efficient than RPC but works without the function being created.
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    # Fetch all embeddings (only viable for small datasets <1000 chunks)
    response = httpx.get(
        f"{supabase_url}/rest/v1/content_embeddings?select=id,chunk_text,chunk_index,embedding,metadata,content_registry_id",
        headers=headers,
        timeout=60,
    )

    if response.status_code != 200:
        return []

    rows = response.json()
    if not rows:
        return []

    # Compute cosine similarity in Python (fallback — use RPC in production)
    import math

    def cosine_similarity(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    scored = []
    for row in rows:
        embedding = row.get("embedding", [])
        if not embedding:
            continue
        if isinstance(embedding, str):
            embedding = json.loads(embedding)
        sim = cosine_similarity(query_embedding, embedding)
        scored.append((sim, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_results = scored[:top_k]

    return [
        RetrievedChunk(
            chunk_id=row.get("id", ""),
            chunk_text=row.get("chunk_text", ""),
            chunk_index=row.get("chunk_index", 0),
            content_type="",
            title="",
            url="",
            section_heading="",
            similarity=sim,
            metadata=json.loads(row.get("metadata", "{}")) if isinstance(row.get("metadata"), str) else row.get("metadata", {}),
        )
        for sim, row in top_results
    ]


# ──────────────────────────────────────────────
# Training Data Search
# ──────────────────────────────────────────────

def search_training_data(
    query_embedding: list[float],
    query: str,
    supabase_url: str,
    supabase_key: str,
    top_k: int = 3,
) -> list[TrainingMatch]:
    """
    Search training_data for personal knowledge relevant to the query.
    Uses a dual strategy:
      1. Semantic vector search via match_training_embeddings (if embeddings exist)
      2. Text similarity fallback via match_training_data (pg_trgm)
    Results are merged and deduplicated.
    """
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    matches: list[TrainingMatch] = []
    seen_ids: set[str] = set()

    # Strategy 1: Semantic vector search
    try:
        payload = {
            "query_embedding": str(query_embedding),
            "match_threshold": 0.3,
            "match_count": top_k,
        }
        response = httpx.post(
            f"{supabase_url}/rest/v1/rpc/match_training_embeddings",
            json=payload,
            headers=headers,
            timeout=15,
        )
        if response.status_code == 200:
            results = response.json()
            for r in results:
                entry_id = r.get("id", "")
                if entry_id not in seen_ids:
                    seen_ids.add(entry_id)
                    matches.append(TrainingMatch(
                        entry_id=entry_id,
                        question=r.get("question", ""),
                        answer=r.get("answer", ""),
                        category=r.get("category", ""),
                        source=r.get("source", ""),
                        similarity=r.get("similarity", 0.0),
                    ))
            if matches:
                logger.info(f"Training semantic search found {len(matches)} matches")
        else:
            logger.warning(f"match_training_embeddings RPC failed ({response.status_code})")
    except Exception as e:
        logger.warning(f"Training semantic search failed: {e}")

    # Strategy 2: Text similarity fallback (pg_trgm) if semantic found fewer than top_k
    if len(matches) < top_k:
        try:
            payload = {
                "search_query": query,
                "match_count": top_k,
            }
            response = httpx.post(
                f"{supabase_url}/rest/v1/rpc/match_training_data",
                json=payload,
                headers=headers,
                timeout=15,
            )
            if response.status_code == 200:
                results = response.json()
                for r in results:
                    entry_id = r.get("id", "")
                    if entry_id not in seen_ids:
                        seen_ids.add(entry_id)
                        matches.append(TrainingMatch(
                            entry_id=entry_id,
                            question=r.get("question", ""),
                            answer=r.get("answer", ""),
                            category=r.get("category", ""),
                            source=r.get("source", "training"),
                            similarity=r.get("similarity", 0.0),
                        ))
                if len(matches) > len(seen_ids) - len(results):
                    logger.info(f"Training text search added {len(results)} additional matches")
            else:
                logger.debug(f"match_training_data RPC failed ({response.status_code}) — may not be deployed yet")
        except Exception as e:
            logger.debug(f"Training text search fallback failed: {e}")

    # Sort by similarity descending, cap at top_k
    matches.sort(key=lambda m: m.similarity, reverse=True)
    return matches[:top_k]


# ──────────────────────────────────────────────
# Context Assembly
# ──────────────────────────────────────────────

def build_rag_context(
    chunks: list[RetrievedChunk],
    query: str,
    training_matches: Optional[list[TrainingMatch]] = None,
    search_type: str = "none",
) -> RAGContext:
    """
    Assemble retrieved chunks and training matches into a formatted context for the LLM.
    Includes citation references.
    Training matches get a dedicated "Personal Knowledge" section.
    """
    training_matches = training_matches or []

    if not chunks and not training_matches:
        return RAGContext(
            chunks=[],
            query=query,
            total_tokens_estimate=0,
            context_text="No relevant content found in the knowledge base.",
            citations=[],
            search_type=search_type,
        )

    # Build context text with citation markers
    # All chunks go into LLM context, but citations are deduplicated by URL
    context_parts = []
    all_citations_raw = []

    for i, chunk in enumerate(chunks):
        citation_id = f"[{i + 1}]"

        context_parts.append(
            f"{citation_id} (Relevance: {chunk.similarity:.2f})\n"
            f"{chunk.chunk_text}\n"
        )

        url = f"https://kiranrao.ai{chunk.url}" if chunk.url else ""
        all_citations_raw.append({
            "id": citation_id,
            "title": chunk.title,
            "url": url,
            "section": chunk.section_heading,
            "content_type": chunk.content_type,
            "similarity": round(chunk.similarity, 3),
        })

    context_text = "\n---\n".join(context_parts)

    # Append training matches as a separate "Personal Knowledge" section
    if training_matches:
        training_parts = []
        for tm in training_matches:
            training_parts.append(
                f"Q: {tm.question}\n"
                f"A: {tm.answer}\n"
                f"(Category: {tm.category}, Relevance: {tm.similarity:.2f})"
            )
        training_section = (
            "\n\n--- PERSONAL KNOWLEDGE (from Kiran's training data — prioritize for personal/opinion questions) ---\n\n"
            + "\n\n".join(training_parts)
        )
        context_text = context_text + training_section if context_text else training_section

    # Deduplicate citations by URL — keep the highest-similarity one per page
    # Cap at 3 unique citation chips sent to the frontend
    seen_urls = {}
    for c in all_citations_raw:
        url = c["url"]
        if url not in seen_urls or c["similarity"] > seen_urls[url]["similarity"]:
            seen_urls[url] = c

    # Sort by similarity descending, take top 3
    citations = sorted(seen_urls.values(), key=lambda c: c["similarity"], reverse=True)[:3]
    # Re-number citation IDs for the frontend chips
    for i, c in enumerate(citations):
        c["id"] = f"[{i + 1}]"

    # Collect similarity scores for logging
    similarity_scores = [round(c.similarity, 3) for c in chunks]

    # Estimate tokens
    total_chars = len(context_text)
    token_estimate = total_chars // 4

    return RAGContext(
        chunks=chunks,
        query=query,
        total_tokens_estimate=token_estimate,
        context_text=context_text,
        citations=citations,
        search_type=search_type,
        similarity_scores=similarity_scores,
        training_matches=training_matches,
    )


# ──────────────────────────────────────────────
# Main RAG Pipeline Function
# ──────────────────────────────────────────────

async def retrieve(
    query: str,
    supabase_url: str,
    supabase_key: str,
    voyage_key: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
    content_type_filter: Optional[str] = None,
    source_type_filter: Optional[str] = None,
) -> RAGContext:
    """
    Full RAG retrieval pipeline.

    Args:
        query: User's question
        supabase_url: Supabase project URL
        supabase_key: Supabase service key
        voyage_key: Voyage AI API key (optional — uses fallback if missing)
        top_k: Number of chunks to retrieve
        content_type_filter: Optional filter (e.g., "teardown", "blog")
        source_type_filter: 'published' for curated content, 'flame_on' for
                           working-process data. None returns all. When Flame On
                           toggle is ON, pass 'flame_on'. When OFF, pass 'published'.

    Returns:
        RAGContext with retrieved chunks and formatted context text
    """
    # Step 1: Embed the query
    if voyage_key:
        logger.info(f"RAG query: '{query[:80]}' — using Voyage AI embeddings (source_type={source_type_filter or 'all'})")
        query_embedding = embed_query_voyage(query, voyage_key)
    else:
        logger.warning(f"RAG query: '{query[:80]}' — VOYAGE_API_KEY missing, using hash fallback (results will be poor)")
        query_embedding = embed_query_fallback(query)

    # Step 2: Search for similar chunks (semantic vector search)
    search_type = "semantic"
    chunks = search_similar_chunks(
        query_embedding=query_embedding,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        top_k=top_k,
        content_type_filter=content_type_filter,
        source_type_filter=source_type_filter,
    )

    top_sim = f"{chunks[0].similarity:.3f}" if chunks else "N/A"
    logger.info(f"RAG retrieved {len(chunks)} chunks (top similarity: {top_sim})")

    # Step 2b: Keyword fallback — if semantic search found nothing,
    # try a text-based keyword search as a safety net.
    if not chunks:
        logger.info(f"Semantic search returned 0 results for '{query[:80]}' — trying keyword fallback")
        search_type = "keyword"
        chunks = _keyword_search(
            query=query,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            top_k=top_k,
            content_type_filter=content_type_filter,
            source_type_filter=source_type_filter,
        )
        if chunks:
            logger.info(f"Keyword fallback recovered {len(chunks)} chunks")
        else:
            search_type = "none"

    # Step 2c: Search training data (personal knowledge Q&A pairs)
    training_matches = []
    try:
        training_matches = search_training_data(
            query_embedding=query_embedding,
            query=query,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            top_k=3,
        )
        if training_matches:
            logger.info(f"Training data search found {len(training_matches)} matches")
    except Exception as e:
        logger.warning(f"Training data search failed (non-fatal): {e}")

    # Step 3: Build context (includes both content chunks and training matches)
    context = build_rag_context(
        chunks, query,
        training_matches=training_matches,
        search_type=search_type,
    )

    return context


# Synchronous version for scripts and testing
def retrieve_sync(
    query: str,
    supabase_url: str,
    supabase_key: str,
    voyage_key: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
    content_type_filter: Optional[str] = None,
    source_type_filter: Optional[str] = None,
) -> RAGContext:
    """Synchronous version of retrieve()."""
    if voyage_key:
        query_embedding = embed_query_voyage(query, voyage_key)
    else:
        query_embedding = embed_query_fallback(query)

    search_type = "semantic"
    chunks = search_similar_chunks(
        query_embedding=query_embedding,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        top_k=top_k,
        content_type_filter=content_type_filter,
        source_type_filter=source_type_filter,
    )

    # Keyword fallback for sync version too
    if not chunks:
        search_type = "keyword"
        chunks = _keyword_search(
            query=query.lower(),
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            top_k=top_k,
            content_type_filter=content_type_filter,
            source_type_filter=source_type_filter,
        )
        if not chunks:
            search_type = "none"

    # Search training data
    training_matches = []
    try:
        training_matches = search_training_data(
            query_embedding=query_embedding,
            query=query,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            top_k=3,
        )
    except Exception:
        pass

    return build_rag_context(
        chunks, query,
        training_matches=training_matches,
        search_type=search_type,
    )


# ──────────────────────────────────────────────
# Supabase RPC Functions (SQL to create)
# ──────────────────────────────────────────────

MATCH_FUNCTION_SQL = """
-- Run this in Supabase SQL Editor to create the vector search function.
-- This is much more efficient than fetching all embeddings client-side.

CREATE OR REPLACE FUNCTION match_content_embeddings(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.2,
    match_count int DEFAULT 5,
    filter_content_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    chunk_text text,
    chunk_index int,
    content_type text,
    title text,
    url text,
    section_heading text,
    similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.chunk_text,
        ce.chunk_index,
        cr.content_type,
        cr.title,
        cr.url,
        COALESCE((ce.metadata->>'heading'), '') AS section_heading,
        (1 - (ce.embedding <=> query_embedding))::float AS similarity,
        ce.metadata
    FROM content_embeddings ce
    JOIN content_registry cr ON ce.content_registry_id = cr.id
    WHERE (1 - (ce.embedding <=> query_embedding)) > match_threshold
    AND (filter_content_type IS NULL OR cr.content_type = filter_content_type)
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
"""

KEYWORD_SEARCH_SQL = """
-- Keyword text search fallback. Called when vector search returns 0 results.

CREATE OR REPLACE FUNCTION keyword_search_content(
    search_terms text,
    match_count int DEFAULT 5,
    filter_content_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    chunk_text text,
    chunk_index int,
    content_type text,
    title text,
    url text,
    section_heading text,
    similarity float,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.chunk_text,
        ce.chunk_index,
        cr.content_type,
        cr.title,
        cr.url,
        COALESCE((ce.metadata->>'heading'), '') AS section_heading,
        0.1::float AS similarity,
        ce.metadata
    FROM content_embeddings ce
    JOIN content_registry cr ON ce.content_registry_id = cr.id
    WHERE ce.chunk_text ILIKE '%' || search_terms || '%'
    AND (filter_content_type IS NULL OR cr.content_type = filter_content_type)
    ORDER BY length(ce.chunk_text) ASC
    LIMIT match_count;
END;
$$;
"""
