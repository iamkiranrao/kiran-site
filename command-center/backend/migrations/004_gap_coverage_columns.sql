-- Migration 004: Add gap coverage columns to evidence_gap_items
-- Part of Gap Coverage System (Phases 1-4)
-- These columns support: gap discovery source tracking, fill strategy,
-- and initiative linkage for the gap-closing loop.

ALTER TABLE evidence_gap_items
  ADD COLUMN IF NOT EXISTS discovered_from TEXT DEFAULT 'manual'
    CHECK (discovered_from IN ('manual', 'jd-scan', 'resume-analysis', 'fenix-training')),
  ADD COLUMN IF NOT EXISTS source_jd_company TEXT,
  ADD COLUMN IF NOT EXISTS source_jd_role TEXT,
  ADD COLUMN IF NOT EXISTS requirement_frequency INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS closed_by_initiative_id TEXT,
  ADD COLUMN IF NOT EXISTS fill_tier TEXT
    CHECK (fill_tier IN ('articulate', 'build-proof', 'certify', 'true-gap')),
  ADD COLUMN IF NOT EXISTS fill_action TEXT,
  ADD COLUMN IF NOT EXISTS fill_time_estimate TEXT,
  ADD COLUMN IF NOT EXISTS fill_output TEXT;

-- Index for querying gaps by discovery source (e.g., all gaps from JD scans)
CREATE INDEX IF NOT EXISTS idx_gap_items_discovered_from
  ON evidence_gap_items(discovered_from);

-- Index for querying gaps by fill tier (e.g., all "articulate" tier gaps)
CREATE INDEX IF NOT EXISTS idx_gap_items_fill_tier
  ON evidence_gap_items(fill_tier);

-- Index for finding gaps linked to a specific initiative
CREATE INDEX IF NOT EXISTS idx_gap_items_closed_by
  ON evidence_gap_items(closed_by_initiative_id)
  WHERE closed_by_initiative_id IS NOT NULL;
