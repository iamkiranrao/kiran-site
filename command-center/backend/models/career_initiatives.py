"""Career Initiatives data models."""

from pydantic import BaseModel
from typing import Optional, List


VALID_DOMAINS = [
    "auth-identity",
    "payments",
    "growth-adoption",
    "ai-ml",
    "mobile",
    "marketplace",
    "engagement",
    "security",
    "fraud",
    "platform",
    "personalization",
    "notifications",
    "lending",
    "wealth",
    "zero-to-one",
    "strategy",
]

VALID_COMPANIES = [
    "wells-fargo",
    "first-republic",
    "avatour",
    "consulting",
    "magley",
]

VALID_ERAS = [
    "enterprise",
    "startup",
    "consulting",
    "ai-chapter",
]


class InitiativeCreate(BaseModel):
    title: str
    one_liner: str = ""
    company: str = ""                               # One of VALID_COMPANIES
    role: str = ""                                   # e.g. "VP of Product"
    era: str = ""                                    # One of VALID_ERAS
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    domains: List[str] = []                          # From VALID_DOMAINS
    tags: List[str] = []                             # Freeform tags

    # Four-beat narrative
    problem: str = ""                                # "The Problem"
    bet: str = ""                                    # "The Bet"
    shipped: str = ""                                # "What Shipped"
    outcome: str = ""                                # "The Outcome"

    # Headline metric
    headline_metric_number: str = ""                 # e.g. "27.5M"
    headline_metric_label: str = ""                  # e.g. "users"

    # Detailed outcome metrics
    outcome_metrics: List[dict] = []                 # [{"number": "27.5M", "label": "Active users"}, ...]

    # Gallery placeholders
    gallery_items: List[str] = []

    # Visibility
    public: bool = True
    fenix_indexed: bool = True

    # Gap Coverage linkage (Phase 3)
    closed_gap_id: Optional[str] = None              # Links back to Mind the Gap item this initiative closed
    requirement_coverage: List[str] = []             # Requirement patterns this initiative demonstrates


class InitiativeUpdate(BaseModel):
    title: Optional[str] = None
    one_liner: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    era: Optional[str] = None
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    domains: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    problem: Optional[str] = None
    bet: Optional[str] = None
    shipped: Optional[str] = None
    outcome: Optional[str] = None
    headline_metric_number: Optional[str] = None
    headline_metric_label: Optional[str] = None
    outcome_metrics: Optional[List[dict]] = None
    gallery_items: Optional[List[str]] = None
    public: Optional[bool] = None
    fenix_indexed: Optional[bool] = None
    notes: Optional[str] = None
    # Gap Coverage linkage (Phase 3)
    closed_gap_id: Optional[str] = None
    requirement_coverage: Optional[List[str]] = None
