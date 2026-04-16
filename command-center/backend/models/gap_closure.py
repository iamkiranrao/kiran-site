"""Gap Closure data models — request/response schemas for closure plan generation.

A closure plan takes a gap × target company pair and produces a 4-section plan:
1. Company Assessment Intelligence — how this company evaluates this competency
2. Existing Evidence Mining — what's already in the vault or adjacent experience
3. Closure Path — sequenced steps (reframe, orient, train, prototype, publish, consult)
4. Definition of Done — artifacts, interview answer draft, vault update
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


# ── Enums ──────────────────────────────────────────────────

class ClosureStepType(str, Enum):
    reframe = "reframe"
    orient = "orient"
    train = "train"
    prototype = "prototype"
    publish = "publish"
    consult = "consult"


class StepStatus(str, Enum):
    pending = "pending"
    in_progress = "in-progress"
    done = "done"
    skipped = "skipped"


# ── Request Models ─────────────────────────────────────────

class ClosurePlanRequest(BaseModel):
    """Input for generating a closure plan."""
    gap_id: str = Field(..., description="ID of the gap item from evidence_gap_items")
    target_company: Optional[str] = Field(None, description="Override: force calibration to this company. If omitted, auto-selects the highest-bar company.")
    role_focus: Optional[str] = Field(None, description="ai-ml, growth, consumer, platform, enterprise, infrastructure")


class StepStatusUpdate(BaseModel):
    """Update the status of a specific closure step."""
    step_index: int = Field(..., ge=0, description="Index of the step in closure_path")
    status: StepStatus
    journal_note: Optional[str] = Field(None, description="Optional note about what was done")


# ── Response Models (Plan Sections) ────────────────────────

class CompanyAssessment(BaseModel):
    """Section 1: How the target company evaluates this competency."""
    interview_process: str = Field(..., description="How they assess this in interviews")
    signals_they_look_for: str = Field(..., description="What interviewers care about")
    operating_level_bar: str = Field(..., description="What operating-level competency looks like here")
    internal_examples: List[str] = Field(default_factory=list, description="Product/blog/talk examples")


class VaultMatch(BaseModel):
    """A vault initiative that could be reframed to cover the gap."""
    initiative_id: str
    title: str
    company: str
    reframe_suggestion: str = Field(..., description="How to re-articulate this to address the gap")


class ExistingEvidence(BaseModel):
    """Section 2: What already exists to cover this gap."""
    vault_matches: List[VaultMatch] = Field(default_factory=list)
    industry_research: str = Field("", description="What was happening at former employers during Kiran's tenure")
    era_narratives: List[str] = Field(default_factory=list, description="How others articulated this competency in that era")
    storytelling_frameworks: str = Field("", description="Recommended framing approaches")


class ClosureResource(BaseModel):
    """A specific resource linked to a closure step."""
    title: str
    url: Optional[str] = None
    type: str = Field(..., description="article, course, certification, platform, book, tool")


class ClosureStep(BaseModel):
    """A single step in the sequenced closure path."""
    step_type: ClosureStepType
    title: str
    description: str
    resources: List[ClosureResource] = Field(default_factory=list)
    time_estimate: str
    artifacts: List[str] = Field(default_factory=list, description="What this step produces")
    status: StepStatus = StepStatus.pending
    journal_note: Optional[str] = Field(None, description="Notes on progress/completion")


class DefinitionOfDone(BaseModel):
    """Section 4: What 'closed' looks like."""
    artifacts_checklist: List[str] = Field(default_factory=list)
    interview_answer_draft: str = Field("", description="2-3 sentence draft framing for interviews")
    vault_update_needed: str = Field("", description="How to update the vault when done")
    self_assessment_prompt: str = Field("", description="The 'can I speak to this for 10 min' test")


# ── Full Closure Plan ──────────────────────────────────────

class ClosurePlan(BaseModel):
    """Complete closure plan for a gap × company pair."""
    id: str = Field(..., description="gap_id--company-slug")
    gap_id: str
    gap_title: str
    gap_canonical_key: Optional[str] = None
    target_company: str
    role_focus: Optional[str] = None

    # The 4 sections
    company_assessment: CompanyAssessment
    existing_evidence: ExistingEvidence
    closure_path: List[ClosureStep]
    definition_of_done: DefinitionOfDone

    # Metadata
    created_at: str
    updated_at: str
    companies_affected: List[str] = Field(default_factory=list, description="Other companies with same gap")
    gap_frequency: Optional[int] = Field(None, description="How many JDs surface this gap")

    # Closure journal
    closure_journal: List[dict] = Field(default_factory=list, description="Running log of closure progress")
