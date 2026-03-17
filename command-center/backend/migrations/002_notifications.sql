-- ============================================================
-- Notifications table for Command Center
-- Run this in the Supabase SQL Editor for project gndzmmywtxvlukoavadj
-- ============================================================

-- Notifications table — unified inbox for all actionable items
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- What kind of notification
    type TEXT NOT NULL CHECK (type IN (
        'feedback',           -- New site feedback submission
        'testimonial',        -- New testimonial pending approval
        'fenix_widget',       -- Fenix widget feedback
        'fenix_dead_end',     -- Fenix conversation with no RAG results
        'task_failure',       -- Scheduled task failed
        'embedding_status',   -- Embedding pipeline event
        'content_freshness',  -- Stale content alert
        'journal_pending',    -- Journal entry pending review
        'training_progress',  -- Training milestone or gap alert
        'draft_content',      -- Content waiting for publish
        'system'              -- Generic system notification
    )),

    -- Where it came from
    source TEXT NOT NULL DEFAULT 'system',  -- e.g. 'feedback_service', 'journal_pipeline', 'fenix_backend'

    -- Display fields
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    action_url TEXT,  -- Deep link into Command Center or external URL

    -- Priority & state
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read BOOLEAN DEFAULT false,
    dismissed BOOLEAN DEFAULT false,

    -- Optional reference to source record
    reference_id TEXT,  -- UUID or ID of the source record (feedback id, conversation id, etc.)

    -- Metadata for type-specific data
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ
);

-- ── Indexes ───────────────────────────────────────────────────

-- Primary query: unread, undismissed, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
    ON notifications (dismissed, read, created_at DESC);

-- Filter by type
CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON notifications (type, created_at DESC);

-- Filter by priority
CREATE INDEX IF NOT EXISTS idx_notifications_priority
    ON notifications (priority, created_at DESC);

-- Lookup by reference (to check for duplicates)
CREATE INDEX IF NOT EXISTS idx_notifications_reference
    ON notifications (type, reference_id)
    WHERE reference_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow service_role (used by the backend) full access
CREATE POLICY "Service role has full access to notifications"
    ON notifications FOR ALL
    USING (true)
    WITH CHECK (true);
