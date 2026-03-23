-- ============================================================
-- Expand notification types for System Wiring Task 2
-- Run this in the Supabase SQL Editor for project gndzmmywtxvlukoavadj
-- ============================================================

-- Drop the existing CHECK constraint on the type column
-- and replace with an expanded list that includes all notification types.
--
-- New types added:
--   action_item, journal_entry, docs_drift (already in Python VALID_TYPES)
--   standards_violation, job_match, interview_reminder, health_alert, cost_alert

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    -- Original types (from 002_notifications.sql)
    'feedback',
    'testimonial',
    'fenix_widget',
    'fenix_dead_end',
    'task_failure',
    'embedding_status',
    'content_freshness',
    'journal_pending',
    'training_progress',
    'draft_content',
    'system',
    -- Added post-002 (already in Python VALID_TYPES)
    'action_item',
    'journal_entry',
    'docs_drift',
    -- Added in System Wiring Task 2
    'standards_violation',
    'job_match',
    'interview_reminder',
    'health_alert',
    'cost_alert'
));
