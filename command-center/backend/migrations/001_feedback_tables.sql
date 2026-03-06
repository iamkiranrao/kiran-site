-- ============================================================
-- Feedback & Testimonials tables for Command Center
-- Run this in the Supabase SQL Editor for project gndzmmywtxvlukoavadj
-- ============================================================

-- Site Feedback table
CREATE TABLE IF NOT EXISTS site_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rating TEXT CHECK (rating IN ('love', 'like', 'neutral', 'dislike')),
    comment TEXT DEFAULT '',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for filtering by rating and ordering by date
CREATE INDEX IF NOT EXISTS idx_site_feedback_created_at ON site_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_feedback_rating ON site_feedback (rating);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT '',
    testimonial TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for filtering by status and ordering by date
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON testimonials (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials (status);

-- Enable RLS (Row Level Security) but allow service_role full access
ALTER TABLE site_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Allow service_role (used by the backend) full access
CREATE POLICY "Service role has full access to site_feedback"
    ON site_feedback FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to testimonials"
    ON testimonials FOR ALL
    USING (true)
    WITH CHECK (true);
