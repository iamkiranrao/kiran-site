-- Migration 005: Flame On source_type filtering
-- Adds source_type column to content_embeddings and content_registry
-- to support Flame On mode (filtering between published curated content
-- and working-process data like journal entries, session transcripts, guides).
--
-- When Flame On is OFF: queries filter to source_type = 'published'
-- When Flame On is ON:  queries filter to source_type = 'flame_on'

-- ── Step 1: Add source_type column to content_registry ──────────
ALTER TABLE content_registry
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'published';

COMMENT ON COLUMN content_registry.source_type IS
  'Content origin: published = curated site content, flame_on = working-process data (journal, sessions, guides)';

-- ── Step 2: Add source_type column to content_embeddings ────────
ALTER TABLE content_embeddings
ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'published';

COMMENT ON COLUMN content_embeddings.source_type IS
  'Denormalized from content_registry for fast vector-search filtering without JOIN overhead';

-- ── Step 3: Index for fast source_type filtering ────────────────
CREATE INDEX IF NOT EXISTS idx_content_embeddings_source_type
ON content_embeddings (source_type);

CREATE INDEX IF NOT EXISTS idx_content_registry_source_type
ON content_registry (source_type);

-- ── Step 4: Update match_content_embeddings to support source_type ──
CREATE OR REPLACE FUNCTION match_content_embeddings(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.2,
    match_count int DEFAULT 5,
    filter_content_type text DEFAULT NULL,
    filter_source_type text DEFAULT NULL
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
    metadata jsonb,
    source_type text
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
        ce.metadata,
        ce.source_type
    FROM content_embeddings ce
    JOIN content_registry cr ON ce.content_registry_id = cr.id
    WHERE (1 - (ce.embedding <=> query_embedding)) > match_threshold
    AND (filter_content_type IS NULL OR cr.content_type = filter_content_type)
    AND (filter_source_type IS NULL OR ce.source_type = filter_source_type)
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Step 5: Update keyword_search_content to support source_type ──
CREATE OR REPLACE FUNCTION keyword_search_content(
    search_terms text,
    match_count int DEFAULT 5,
    filter_content_type text DEFAULT NULL,
    filter_source_type text DEFAULT NULL
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
    metadata jsonb,
    source_type text
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
        ce.metadata,
        ce.source_type
    FROM content_embeddings ce
    JOIN content_registry cr ON ce.content_registry_id = cr.id
    WHERE ce.chunk_text ILIKE '%' || search_terms || '%'
    AND (filter_content_type IS NULL OR cr.content_type = filter_content_type)
    AND (filter_source_type IS NULL OR ce.source_type = filter_source_type)
    ORDER BY length(ce.chunk_text) ASC
    LIMIT match_count;
END;
$$;

-- ── Step 6: Grant permissions ───────────────────────────────────
GRANT EXECUTE ON FUNCTION match_content_embeddings TO service_role;
GRANT EXECUTE ON FUNCTION match_content_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION keyword_search_content TO service_role;
GRANT EXECUTE ON FUNCTION keyword_search_content TO authenticated;

-- ── Step 7: Mark existing content as 'published' (idempotent) ───
UPDATE content_embeddings SET source_type = 'published' WHERE source_type IS NULL;
UPDATE content_registry SET source_type = 'published' WHERE source_type IS NULL;
