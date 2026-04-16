"""Evidence management data models for the Skills page."""

from pydantic import BaseModel, Field
from typing import Optional, List


# ── Domains ──────────────────────────────────────────────────

class DomainCreate(BaseModel):
    id: str = Field(..., pattern=r"^[a-z][a-z0-9-]*$", max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#7CADE8", pattern=r"^#[0-9a-fA-F]{6}$")
    sort_order: int = Field(default=0)


class DomainUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")
    sort_order: Optional[int] = None


# ── Skills ───────────────────────────────────────────────────

class SkillCreate(BaseModel):
    id: str = Field(..., pattern=r"^[a-z][a-z0-9-]*$", max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    domain_id: str
    sort_order: int = Field(default=0)


class SkillUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    domain_id: Optional[str] = None
    sort_order: Optional[int] = None


# ── Sources ──────────────────────────────────────────────────

class SourceCreate(BaseModel):
    id: str = Field(..., pattern=r"^[a-z][a-z0-9-]*$", max_length=80)
    label: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern=r"^(certification|prototype|project|teardown)$")
    issuer: Optional[str] = None
    year: Optional[int] = Field(None, ge=2000, le=2100)
    url: Optional[str] = None


class SourceUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = Field(None, pattern=r"^(certification|prototype|project|teardown)$")
    issuer: Optional[str] = None
    year: Optional[int] = Field(None, ge=2000, le=2100)
    url: Optional[str] = None


# ── Skill Links ──────────────────────────────────────────────

class SkillLinkCreate(BaseModel):
    source_id: str
    skill_id: str


class SkillLinkBulkCreate(BaseModel):
    source_id: str
    skill_ids: List[str]


# ── Cert Details ─────────────────────────────────────────────

class CertDetailCreate(BaseModel):
    source_id: str
    name: str
    issuer_full: str
    credential: Optional[str] = None
    logo: Optional[str] = None
    learned: Optional[str] = None
    display_skills: List[str] = Field(default_factory=list)
    capstone_label: str = "Certification"
    capstone: Optional[str] = None


class CertDetailUpdate(BaseModel):
    name: Optional[str] = None
    issuer_full: Optional[str] = None
    credential: Optional[str] = None
    logo: Optional[str] = None
    learned: Optional[str] = None
    display_skills: Optional[List[str]] = None
    capstone_label: Optional[str] = None
    capstone: Optional[str] = None


# ── Evidence Item Details ────────────────────────────────────

class ItemDetailCreate(BaseModel):
    source_id: str
    name: str
    type: str = Field(..., pattern=r"^(prototype|project|teardown)$")
    tagline: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    display_skills: List[str] = Field(default_factory=list)
    highlight: Optional[str] = None
    status: Optional[str] = None


class ItemDetailUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = Field(None, pattern=r"^(prototype|project|teardown)$")
    tagline: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    display_skills: Optional[List[str]] = None
    highlight: Optional[str] = None
    status: Optional[str] = None


# ── Gap Items ("Mind the Gap") ──────────────────────────────

class GapItemCreate(BaseModel):
    id: str = Field(..., pattern=r"^[a-z][a-z0-9-]*$", max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., pattern=r"^(critical-gap|recognized-cert|persona-cred|domain-specialty|adjacent-skill|horizon-expander|tool-proficiency|framework-method)$")
    subcategory: Optional[str] = None
    priority: str = Field(default="medium", pattern=r"^(critical|high|medium|low|nice-to-have)$")
    persona_relevance: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    why_it_matters: Optional[str] = None
    current_status: str = Field(default="not-started", pattern=r"^(not-started|researching|in-progress|completed|deprioritized)$")
    provider: Optional[str] = None
    provider_url: Optional[str] = None
    cost: Optional[str] = None
    time_estimate: Optional[str] = None
    alternative_sources: Optional[str] = None
    demonstration_idea: Optional[str] = None
    demonstration_type: Optional[str] = Field(None, pattern=r"^(prototype|teardown|case-study|dashboard|content|certification|tool-artifact)$")
    portfolio_value: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    sort_order: int = Field(default=0)
    # Gap Coverage fields (Phase 2)
    discovered_from: str = Field(default="manual", pattern=r"^(manual|jd-scan|resume-analysis|fenix-training)$")
    source_jd_company: Optional[str] = None
    source_jd_role: Optional[str] = None
    requirement_frequency: int = Field(default=1, ge=1)
    closed_by_initiative_id: Optional[str] = None
    fill_tier: Optional[str] = Field(None, pattern=r"^(articulate|build-proof|certify|true-gap)$")
    fill_action: Optional[str] = None
    fill_time_estimate: Optional[str] = None
    fill_output: Optional[str] = None
    resolution_type: Optional[str] = Field(None, pattern=r"^(have-it|reframed|built-proof|certified|not-pursuing|not-a-gap)$")
    resolution_note: Optional[str] = Field(None, max_length=500)
    # Lens fields
    seniority_level: Optional[str] = Field(None, pattern=r"^(ic|manager|director|vp-plus)$")
    role_focus: Optional[str] = Field(None, pattern=r"^(ai-ml|growth|consumer|platform|enterprise|infrastructure)$")
    # Interview prep
    interview_questions: List[dict] = Field(default_factory=list)
    prepared_answers: List[dict] = Field(default_factory=list)


class GapItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, pattern=r"^(critical-gap|recognized-cert|persona-cred|domain-specialty|adjacent-skill|horizon-expander|tool-proficiency|framework-method)$")
    subcategory: Optional[str] = None
    priority: Optional[str] = Field(None, pattern=r"^(critical|high|medium|low|nice-to-have)$")
    persona_relevance: Optional[List[str]] = None
    description: Optional[str] = None
    why_it_matters: Optional[str] = None
    current_status: Optional[str] = Field(None, pattern=r"^(not-started|researching|in-progress|completed|deprioritized)$")
    provider: Optional[str] = None
    provider_url: Optional[str] = None
    cost: Optional[str] = None
    time_estimate: Optional[str] = None
    alternative_sources: Optional[str] = None
    demonstration_idea: Optional[str] = None
    demonstration_type: Optional[str] = Field(None, pattern=r"^(prototype|teardown|case-study|dashboard|content|certification|tool-artifact)$")
    portfolio_value: Optional[str] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = None
    # Gap Coverage fields (Phase 2)
    discovered_from: Optional[str] = Field(None, pattern=r"^(manual|jd-scan|resume-analysis|fenix-training)$")
    source_jd_company: Optional[str] = None
    source_jd_role: Optional[str] = None
    requirement_frequency: Optional[int] = Field(None, ge=1)
    closed_by_initiative_id: Optional[str] = None
    fill_tier: Optional[str] = Field(None, pattern=r"^(articulate|build-proof|certify|true-gap)$")
    fill_action: Optional[str] = None
    fill_time_estimate: Optional[str] = None
    fill_output: Optional[str] = None
    resolution_type: Optional[str] = Field(None, pattern=r"^(have-it|reframed|built-proof|certified|not-pursuing|not-a-gap)$")
    resolution_note: Optional[str] = Field(None, max_length=500)
    # Lens fields
    seniority_level: Optional[str] = Field(None, pattern=r"^(ic|manager|director|vp-plus)$")
    role_focus: Optional[str] = Field(None, pattern=r"^(ai-ml|growth|consumer|platform|enterprise|infrastructure)$")
    # Interview prep
    interview_questions: Optional[List[dict]] = None
    prepared_answers: Optional[List[dict]] = None
