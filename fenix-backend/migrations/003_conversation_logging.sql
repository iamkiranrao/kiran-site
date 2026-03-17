-- Migration 003: Phase 2 — Conversation Logging & Training Data
-- Run this in Supabase SQL Editor.
--
-- What this does:
-- 1. Adds page_url and user_agent columns to conversations
-- 2. Adds rag_chunks_used, similarity_scores, and search_type to messages
-- 3. Creates the training_data table for curated Q&A pairs
-- 4. Creates match_training_data function for text search
-- 5. Adds indexes for query performance
-- 6. Sets up RLS policies (service_role full access)

-- ──────────────────────────────────────────────
-- 1. ALTER conversations table
-- ──────────────────────────────────────────────

ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS page_url TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ──────────────────────────────────────────────
-- 2. ALTER messages table
-- ──────────────────────────────────────────────

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS rag_chunks_used INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS similarity_scores JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS search_type TEXT CHECK (search_type IN ('semantic', 'keyword', 'none'));

-- ──────────────────────────────────────────────
-- 3. CREATE training_data table
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    source TEXT DEFAULT 'kiran_training',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 4. Indexes
-- ──────────────────────────────────────────────

-- Conversations: fast lookup by session_id (used on every chat request)
CREATE INDEX IF NOT EXISTS idx_conversations_session_id
    ON conversations (session_id);

-- Messages: fast lookup by conversation + time ordering
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages (created_at DESC);

-- Messages: search_type for analytics queries
CREATE INDEX IF NOT EXISTS idx_messages_search_type
    ON messages (search_type);

-- Training data: active entries for RAG retrieval
CREATE INDEX IF NOT EXISTS idx_training_data_status
    ON training_data (status);

-- Training data: full-text search on question column
CREATE INDEX IF NOT EXISTS idx_training_data_question_trgm
    ON training_data USING gin (question gin_trgm_ops);

-- ──────────────────────────────────────────────
-- 5. Enable pg_trgm extension (for fuzzy text search)
-- ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ──────────────────────────────────────────────
-- 6. match_training_data function
--    Text search against training_data table.
--    Returns Q&A pairs where the question is similar to the user query.
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_training_data(
    search_query TEXT,
    match_count INT DEFAULT 3,
    similarity_threshold FLOAT DEFAULT 0.15
)
RETURNS TABLE (
    id UUID,
    question TEXT,
    answer TEXT,
    category TEXT,
    source TEXT,
    similarity FLOAT
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
        similarity(td.question, search_query)::float AS similarity
    FROM training_data td
    WHERE td.status = 'active'
    AND similarity(td.question, search_query) > similarity_threshold
    ORDER BY similarity(td.question, search_query) DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_training_data TO service_role;
GRANT EXECUTE ON FUNCTION match_training_data TO authenticated;

-- ──────────────────────────────────────────────
-- 7. RLS Policies
-- ──────────────────────────────────────────────

-- Enable RLS on new table
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- Service role gets full access to all tables
CREATE POLICY "service_role_full_access_training_data"
    ON training_data
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure conversations and messages also have service_role policies
-- (these may already exist — IF NOT EXISTS isn't supported for policies,
--  so we use DO blocks to avoid errors on re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'conversations'
        AND policyname = 'service_role_full_access_conversations'
    ) THEN
        ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "service_role_full_access_conversations"
            ON conversations FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'messages'
        AND policyname = 'service_role_full_access_messages'
    ) THEN
        ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "service_role_full_access_messages"
            ON messages FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ──────────────────────────────────────────────
-- 8. Updated_at trigger for training_data
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_training_data_updated_at ON training_data;
CREATE TRIGGER set_training_data_updated_at
    BEFORE UPDATE ON training_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
