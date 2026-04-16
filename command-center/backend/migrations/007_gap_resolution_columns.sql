-- Migration 007: Add gap resolution columns to evidence_gap_items
-- Supports the 5-path gap closure system:
--   have-it       → false positive, already possessed
--   reframed      → narrative updated to articulate existing experience
--   built-proof   → new initiative/artifact created as evidence
--   certified     → credential or course completed
--   not-pursuing  → deprioritized, not relevant to target roles

ALTER TABLE evidence_gap_items
  ADD COLUMN IF NOT EXISTS resolution_type TEXT
    CHECK (resolution_type IN ('have-it', 'reframed', 'built-proof', 'certified', 'not-pursuing')),
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- Index for querying resolved gaps by resolution type
CREATE INDEX IF NOT EXISTS idx_gap_items_resolution_type
  ON evidence_gap_items(resolution_type)
  WHERE resolution_type IS NOT NULL;


-- ── Lens System: seniority and role focus for filtering ──

ALTER TABLE evidence_gap_items
  ADD COLUMN IF NOT EXISTS seniority_level TEXT
    CHECK (seniority_level IN ('ic', 'manager', 'director', 'vp-plus')),
  ADD COLUMN IF NOT EXISTS role_focus TEXT
    CHECK (role_focus IN ('ai-ml', 'growth', 'consumer', 'platform', 'enterprise', 'infrastructure'));

-- Index for lens-based queries
CREATE INDEX IF NOT EXISTS idx_gap_items_seniority
  ON evidence_gap_items(seniority_level)
  WHERE seniority_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gap_items_role_focus
  ON evidence_gap_items(role_focus)
  WHERE role_focus IS NOT NULL;
