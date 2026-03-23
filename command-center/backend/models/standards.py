"""Data models for the Standards & Compliance Dashboard.

Covers: check definitions, violations, scoring, reports, and compliance tiers.
Follows BACKEND-STANDARDS.md Section 5 naming: {Entity}Create, {Entity}Update, {Entity}.
"""

from __future__ import annotations

from typing import Dict, Optional, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ── Enums as Literals ─────────────────────────────────────────────────

Pillar = Literal["backend", "architecture", "authenticity", "content", "visual"]
Severity = Literal["critical", "warning", "info"]
ComplianceTier = Literal["ship", "quality", "best-in-class"]
CheckMethod = Literal["regex", "static-analysis", "metric", "claude-api"]
RemediationDifficulty = Literal["auto", "mechanical", "judgment"]


# ── Check Definition ──────────────────────────────────────────────────

class CheckDefinition(BaseModel):
    """A single check that the dashboard knows how to run.

    Check definitions are registered by each pillar's implementation.
    They describe WHAT gets checked, not the result of running it.
    """
    id: str = Field(description="Unique check ID, e.g. 'auth-lexical-tell'")
    pillar: Pillar
    name: str = Field(description="Human-readable name, e.g. 'Lexical Tell Scan'")
    description: str = Field(description="What this check looks for")
    severity_default: Severity = Field(
        description="Default severity when this check fires. "
        "Individual violations can escalate (e.g., 3+ warnings -> critical)."
    )
    method: CheckMethod = Field(
        description="How the check runs: regex, static-analysis, metric, or claude-api"
    )
    remediation_difficulty: RemediationDifficulty = Field(
        description="auto = one-click fix, mechanical = known steps, judgment = human review"
    )
    standards_ref: str = Field(
        description="Reference to the standards doc section, e.g. 'AUTHENTICITY-STANDARDS.md §4.1'"
    )
    enabled: bool = True


# ── Violation (single finding) ────────────────────────────────────────

class Violation(BaseModel):
    """A single violation found by a check."""
    check_id: str = Field(description="Which check produced this violation")
    severity: Severity
    location: str = Field(
        description="Where the violation was found: file path, line number, CSS selector, etc."
    )
    detail: str = Field(description="Human-readable description of what was found")
    evidence: str = Field(
        default="",
        description="The actual text/code snippet that triggered the violation"
    )
    suggestion: str = Field(
        default="",
        description="Specific fix recommendation"
    )
    auto_fixable: bool = Field(
        default=False,
        description="Whether POST /remediate can fix this automatically"
    )


# ── Per-File Report ───────────────────────────────────────────────────

class FileReport(BaseModel):
    """Audit results for a single file."""
    file_path: str
    relative_path: str
    word_count: int = 0
    violations: List[Violation] = []
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0

    @property
    def total_violations(self) -> int:
        return self.critical_count + self.warning_count + self.info_count


# ── Scoring ───────────────────────────────────────────────────────────

class PillarScore(BaseModel):
    """Score for a single pillar (backend, architecture, authenticity, etc.).

    For authenticity, there are TWO sub-scores (anti-ai and pro-kiran)
    and the final is the minimum. For other pillars, a single score.
    """
    pillar: Pillar
    score: int = Field(ge=0, le=100, description="Final pillar score (0-100)")
    anti_ai_score: Optional[int] = Field(
        default=None,
        description="Anti-AI sub-score (authenticity pillar only)"
    )
    pro_kiran_score: Optional[int] = Field(
        default=None,
        description="Pro-Kiran sub-score (authenticity pillar only)"
    )
    rating: str = Field(description="Authentic / Review / Remediate / Rewrite")
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    files_scanned: int = 0
    checks_run: int = 0
    checks_passed: int = 0


class ScorecardEntry(BaseModel):
    """One row in the top-level scorecard — summary per pillar."""
    pillar: Pillar
    pillar_label: str = Field(description="Display name, e.g. 'Authenticity'")
    score: int = Field(ge=0, le=100)
    rating: str
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    new_violations: int = Field(
        default=0,
        description="Violations not in the baseline (new regressions)"
    )
    baselined_violations: int = Field(
        default=0,
        description="Violations that are acknowledged in the baseline"
    )
    compliance_tier: Optional[ComplianceTier] = None
    last_run: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp of last audit run"
    )


class Scorecard(BaseModel):
    """Top-level scorecard — the dashboard landing view."""
    overall_score: int = Field(ge=0, le=100)
    overall_rating: str
    pillars: List[ScorecardEntry]
    generated_at: str = Field(description="ISO 8601 timestamp")
    files_scanned: int = 0
    total_checks_run: int = 0
    total_violations: int = 0


# ── Pillar Detail Report ──────────────────────────────────────────────

class PillarDetail(BaseModel):
    """Full detail for a single pillar — the drill-down view."""
    pillar: Pillar
    pillar_label: str
    score: PillarScore
    checks: List[CheckDefinition] = Field(
        description="All checks registered for this pillar"
    )
    file_reports: List[FileReport] = Field(
        description="Per-file violations"
    )
    new_violations: int = Field(
        default=0,
        description="Violations not in the baseline (new regressions)"
    )
    baselined_violations: int = Field(
        default=0,
        description="Violations that are acknowledged in the baseline"
    )
    compliance_tier: Optional[ComplianceTier] = None
    generated_at: str


# ── Remediation ───────────────────────────────────────────────────────

class RemediationRequest(BaseModel):
    """Request to auto-remediate specific violations."""
    violation_ids: Optional[List[str]] = Field(
        default=None,
        description="Specific violation locations to fix. None = fix all auto-fixable."
    )
    dry_run: bool = Field(
        default=True,
        description="If true, show what would change without applying. Default: true (safe)."
    )


class RemediationResult(BaseModel):
    """Result of a single remediation action."""
    file_path: str
    check_id: str
    original: str
    replacement: str
    applied: bool = Field(description="False if dry_run=True")
    line_number: Optional[int] = None


class RemediationResponse(BaseModel):
    """Response from POST /standards/{pillar}/remediate."""
    pillar: Pillar
    dry_run: bool
    fixes_available: int
    fixes_applied: int
    results: List[RemediationResult]


# ── Baseline / Ignore-Defer System ────────────────────────────────────

class BaselineEntry(BaseModel):
    """A single acknowledged violation in the baseline."""
    check_id: str = Field(description="Which check produced this violation")
    relative_path: str = Field(description="File path relative to site root")
    severity: Severity
    detail: str = Field(description="Description of the violation")
    status: Literal["acknowledged", "deferred"] = Field(
        description="Status: acknowledged (known), deferred (until date)"
    )
    acknowledged_at: str = Field(
        description="ISO 8601 timestamp when this was baselined"
    )
    defer_until: Optional[str] = Field(
        default=None,
        description="ISO 8601 date when this deferred violation will re-appear"
    )
    reason: str = Field(
        description="Why this violation was acknowledged"
    )


class BaselineSnapshot(BaseModel):
    """Full baseline file — all acknowledged violations."""
    version: int = Field(default=1, description="Baseline format version")
    created_at: str = Field(description="ISO 8601 timestamp of baseline creation")
    updated_at: str = Field(description="ISO 8601 timestamp of last update")
    entries: Dict[str, BaselineEntry] = Field(
        description="Mapping of fingerprint -> BaselineEntry"
    )

    @property
    def count(self) -> int:
        """Total number of baselined violations."""
        return len(self.entries)


class BaselineAcknowledgeRequest(BaseModel):
    """Request to acknowledge violations by fingerprint."""
    fingerprints: List[str] = Field(
        description="List of violation fingerprints to acknowledge"
    )
    reason: str = Field(
        description="Why these violations are being acknowledged"
    )
    status: Literal["acknowledged", "deferred"] = Field(
        default="acknowledged",
        description="Status: acknowledged (known) or deferred (until date)"
    )
    defer_until: Optional[str] = Field(
        default=None,
        description="ISO 8601 date if status=deferred. Required if deferred."
    )


class BaselineCheckResponse(BaseModel):
    """Response from checking a file before publish."""
    file_path: str
    relative_path: str
    violations_by_pillar: Dict[Pillar, List[Violation]] = Field(
        description="Violations grouped by pillar"
    )
    has_critical: bool = Field(
        description="True if any critical violations found"
    )
    pass_check: bool = Field(
        description="True if file passes (no critical violations)"
    )


# ── Audit Run Metadata ────────────────────────────────────────────────

class AuditRunMeta(BaseModel):
    """Metadata for a completed audit run — persisted to JSON."""
    id: str
    pillar: Pillar
    started_at: str
    completed_at: str
    duration_ms: int
    files_scanned: int
    checks_run: int
    total_violations: int
    score: int
    rating: str
