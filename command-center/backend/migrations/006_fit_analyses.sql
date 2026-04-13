-- Fit Narrative Analysis Storage
-- Stores completed fit analyses so they can be retrieved by ID
-- for URL-based refresh and sharing

CREATE TABLE IF NOT EXISTS fit_analyses (
    id TEXT PRIMARY KEY,          -- short ID like 'fn_abc12345'
    payload JSONB NOT NULL,       -- full analysis data for page reconstruction
    jd_hash TEXT NOT NULL,        -- SHA-256 of JD text for dedup
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for recent analyses lookup
CREATE INDEX IF NOT EXISTS idx_fit_analyses_created
    ON fit_analyses (created_at DESC);

-- Index for JD dedup
CREATE INDEX IF NOT EXISTS idx_fit_analyses_jd_hash
    ON fit_analyses (jd_hash);

-- RLS
ALTER TABLE fit_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on fit_analyses"
    ON fit_analyses
    FOR ALL
    USING (true)
    WITH CHECK (true);
