"""resume data models."""

from pydantic import BaseModel, field_validator
from typing import Optional

VALID_PERSONAS = {"PM", "PjM", "PMM", "auto"}
VALID_VERSIONS = {"1-Page", "2-Page", "Detailed"}


class ResumeRequest(BaseModel):
    job_description: str
    persona: Optional[str] = "auto"  # PM, PjM, PMM, or auto
    version: Optional[str] = "2-Page"  # 1-Page, 2-Page, Detailed

    @field_validator("persona")
    @classmethod
    def check_persona(cls, v):
        if v and v not in VALID_PERSONAS:
            raise ValueError(f"persona must be one of {sorted(VALID_PERSONAS)}, got '{v}'")
        return v

    @field_validator("version")
    @classmethod
    def check_version(cls, v):
        if v and v not in VALID_VERSIONS:
            raise ValueError(f"version must be one of {sorted(VALID_VERSIONS)}, got '{v}'")
        return v


class URLExtractRequest(BaseModel):
    url: str


class AnalyzeRequest(BaseModel):
    job_description: str
    persona: Optional[str] = "auto"
    version: Optional[str] = "2-Page"

    @field_validator("persona")
    @classmethod
    def check_persona(cls, v):
        if v and v not in VALID_PERSONAS:
            raise ValueError(f"persona must be one of {sorted(VALID_PERSONAS)}, got '{v}'")
        return v

    @field_validator("version")
    @classmethod
    def check_version(cls, v):
        if v and v not in VALID_VERSIONS:
            raise ValueError(f"version must be one of {sorted(VALID_VERSIONS)}, got '{v}'")
        return v


class ApproveRequest(BaseModel):
    job_id: str
    feedback: Optional[str] = None  # Optional user feedback to refine before generation


class RefineSectionRequest(BaseModel):
    job_id: str
    section_id: str
    feedback: str


class DiscussSectionRequest(BaseModel):
    job_id: str
    section_id: str
    message: str
    conversation_history: Optional[list] = []  # [{role: "user"|"assistant", content: str}]


class LockSectionRequest(BaseModel):
    job_id: str
    section_id: str


# ── URL Extraction ───────────────────────────────────────────────────────────


class ParallelGenRequest(BaseModel):
    job_id: str
