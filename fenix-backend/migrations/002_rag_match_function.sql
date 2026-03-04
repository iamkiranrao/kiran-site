-- Migration 002: RAG vector search function
-- Run this in Supabase SQL Editor AFTER content has been indexed.
--
-- What this does:
-- Creates a PostgreSQL function that performs cosine similarity search
-- against the content_embeddings table using pgvector's <=> operator.
-- This is much more efficient than fetching all embeddings client-side
-- because the search happens inside the database.

CREATE OR REPLACE FUNCTION match_content_embeddings(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.3,
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

-- Grant access for the service role
GRANT EXECUTE ON FUNCTION match_content_embeddings TO service_role;

-- Also grant to authenticated users (for Fenix API calls)
GRANT EXECUTE ON FUNCTION match_content_embeddings TO authenticated;
