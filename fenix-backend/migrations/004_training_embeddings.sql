-- Migration 004: Training Data Embeddings
-- Adds vector embedding support to training_data so Fenix can find
-- personal knowledge through semantic search (not just text matching).
--
-- Run in Supabase SQL Editor.
-- ────────────────────────────────────────────────────────────────────

-- 1. Add embedding column to training_data
ALTER TABLE training_data
ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 2. Index for fast vector search
CREATE INDEX IF NOT EXISTS idx_training_data_embedding
ON training_data USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- 3. Semantic search function for training data
CREATE OR REPLACE FUNCTION match_training_embeddings(
    query_embedding vector(512),
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    question text,
    answer text,
    category text,
    source text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        td.id,
        td.question,
        td.answer,
        td.category,
        td.source,
        (1 - (td.embedding <=> query_embedding))::float AS similarity
    FROM training_data td
    WHERE td.status = 'active'
    AND td.embedding IS NOT NULL
    AND (1 - (td.embedding <=> query_embedding)) > match_threshold
    ORDER BY td.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. Grant access to service role
GRANT EXECUTE ON FUNCTION match_training_embeddings TO service_role;
