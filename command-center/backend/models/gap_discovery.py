"""Gap Discovery data models — request/response schemas for the gap analysis pipeline.

The gap discovery engine takes a JD, extracts requirements, maps them against
the career initiatives vault, classifies uncovered areas, and prescribes
fill strategies using the 4-tier system (articulate → build-proof → certify → true-gap).
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ── Single JD Analysis ──────────────────────────────────────


SENIORITY_LEVELS = ("ic", "manager", "director", "vp-plus")
ROLE_FOCUS_OPTIONS = ("ai-ml", "growth", "consumer", "platform", "enterprise", "infrastructure")


class GapAnalysisRequest(BaseModel):
    """Input for analyzing a single job description."""
    jd_text: str = Field(..., min_length=50, description="Full job description text")
    company: Optional[str] = Field(None, description="Company name (auto-extracted if omitted)")
    role_title: Optional[str] = Field(None, description="Role title (auto-extracted if omitted)")
    seniority_level: Optional[str] = Field(None, description="ic, manager, director, vp-plus")
    role_focus: Optional[str] = Field(None, description="ai-ml, growth, consumer, platform, enterprise, infrastructure")
    push_to_gap_table: bool = Field(default=False, description="Auto-create Mind the Gap entries for discovered gaps")


class RequirementExtraction(BaseModel):
    """A single extracted requirement from a JD."""
    requirement: str
    category: str  # experience, domain, skill, tool
    signal_strength: str  # hard (required), soft (nice-to-have)


class EvidenceReference(BaseModel):
    """Links a requirement to a vault initiative that covers it."""
    initiative_id: str
    title: str
    company: str
    metric: str
    relevance_explanation: str


class RequirementCoverage(BaseModel):
    """Full coverage analysis for a single requirement."""
    requirement: str
    category: str
    signal_strength: str
    coverage: str  # strong, partial, articulable, gap
    evidence: List[EvidenceReference] = Field(default_factory=list)
    gap_note: Optional[str] = None
    fill_tier: Optional[str] = None  # articulate, build-proof, certify, true-gap
    fill_action: Optional[str] = None
    fill_time_estimate: Optional[str] = None
    fill_output: Optional[str] = None


class CoverageSummary(BaseModel):
    """Aggregate coverage statistics for a JD analysis."""
    total_requirements: int
    strong: int
    partial: int
    articulable: int
    gaps: int
    coverage_pct: float  # (strong + partial) / total * 100


class GapAnalysisReport(BaseModel):
    """Complete gap analysis for a single JD."""
    report_id: str
    company: Optional[str] = None
    role_title: Optional[str] = None
    seniority_level: Optional[str] = None
    role_focus: Optional[str] = None
    requirements: List[RequirementCoverage]
    coverage_summary: CoverageSummary
    created_at: str
    gaps_pushed: int = 0  # How many new gaps were created in Mind the Gap


# ── Batch Analysis (Phase 4: Aggregate Intelligence) ────────


class BatchJDInput(BaseModel):
    """A single JD in a batch analysis."""
    jd_text: str = Field(..., min_length=50)
    company: Optional[str] = None
    role_title: Optional[str] = None


class BatchAnalysisRequest(BaseModel):
    """Input for analyzing multiple JDs to find structural patterns."""
    jds: List[BatchJDInput] = Field(..., min_items=2, max_items=20)
    push_to_gap_table: bool = Field(default=False)


class StructuralGap(BaseModel):
    """A requirement pattern that appears across multiple target JDs."""
    requirement_pattern: str
    frequency: int  # How many JDs include this requirement
    frequency_pct: float  # frequency / total_jds * 100
    current_coverage: str  # strong, partial, articulable, gap
    fill_tier: Optional[str] = None
    fill_action: Optional[str] = None
    source_companies: List[str] = Field(default_factory=list)


class BatchAnalysisReport(BaseModel):
    """Aggregated analysis across multiple JDs."""
    report_id: str
    total_jds: int
    structural_gaps: List[StructuralGap]
    strong_domains: List[str]  # Domains with consistently strong coverage
    weak_domains: List[str]  # Domains with consistent gaps
    per_jd_reports: List[str]  # IDs of individual reports
    created_at: str
    gaps_pushed: int = 0
