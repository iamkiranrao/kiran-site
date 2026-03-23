"""Data models for the Tech Cost Calculator.

Tracks operational costs across Kiran's entire tech stack:
API usage (Anthropic, Voyage AI), hosting (Vercel, Cloudflare),
databases (Supabase), domains, and any SaaS subscriptions.
"""

from __future__ import annotations

from typing import Optional, List, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ── Enums as Literals ─────────────────────────────────────────────────

CostCategory = Literal[
    "ai-api",       # Anthropic, OpenAI, Voyage AI, etc.
    "hosting",      # Vercel, Cloudflare Pages, VPS
    "database",     # Supabase, managed Postgres
    "domain",       # Domain registration + DNS
    "saas",         # Any SaaS subscriptions
    "ci-cd",        # GitHub Actions, build minutes
    "analytics",    # GA4, Clarity, Mixpanel, etc.
    "other",        # Anything else
]

BillingCycle = Literal["monthly", "annual", "per-use", "one-time"]

CostTrend = Literal["rising", "stable", "falling", "new"]


# ── Service Definition ────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    """Register a service in the tech stack."""
    name: str = Field(description="Service name, e.g. 'Anthropic Claude API'")
    provider: str = Field(description="Provider/company, e.g. 'Anthropic'")
    category: CostCategory
    billing_cycle: BillingCycle
    monthly_budget: Optional[float] = Field(
        default=None,
        description="Monthly budget cap in USD. None = no cap."
    )
    base_cost_monthly: float = Field(
        default=0.0,
        description="Fixed monthly cost in USD (0 for per-use services)"
    )
    is_free_tier: bool = Field(
        default=False,
        description="Whether currently on a free tier"
    )
    notes: str = Field(default="", description="Usage notes or tier details")
    url: str = Field(default="", description="Dashboard/billing URL for this service")
    env_key: str = Field(
        default="",
        description="Environment variable name for the API key, e.g. 'ANTHROPIC_API_KEY'"
    )
    active: bool = True


class ServiceUpdate(BaseModel):
    """Partial update for a service."""
    name: Optional[str] = None
    provider: Optional[str] = None
    category: Optional[CostCategory] = None
    billing_cycle: Optional[BillingCycle] = None
    monthly_budget: Optional[float] = None
    base_cost_monthly: Optional[float] = None
    is_free_tier: Optional[bool] = None
    notes: Optional[str] = None
    url: Optional[str] = None
    env_key: Optional[str] = None
    active: Optional[bool] = None


class Service(ServiceCreate):
    """Full service record with metadata."""
    id: str
    created_at: str
    updated_at: str


# ── Cost Entry (individual charge) ───────────────────────────────────

class CostEntryCreate(BaseModel):
    """Log a cost event — either a manual entry or an auto-tracked API call."""
    service_id: str = Field(description="Which service this cost belongs to")
    amount_usd: float = Field(description="Cost in USD")
    description: str = Field(default="", description="What this charge is for")
    period: str = Field(
        description="Billing period, e.g. '2026-03' for March 2026"
    )
    tokens_input: Optional[int] = Field(
        default=None,
        description="Input tokens (AI API calls only)"
    )
    tokens_output: Optional[int] = Field(
        default=None,
        description="Output tokens (AI API calls only)"
    )
    requests_count: Optional[int] = Field(
        default=None,
        description="Number of API requests in this entry"
    )
    source: Literal["manual", "auto-tracked", "invoice", "estimate"] = Field(
        default="manual",
        description="How this cost was recorded"
    )


class CostEntryUpdate(BaseModel):
    """Partial update for a cost entry."""
    amount_usd: Optional[float] = None
    description: Optional[str] = None
    period: Optional[str] = None
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    requests_count: Optional[int] = None
    source: Optional[Literal["manual", "auto-tracked", "invoice", "estimate"]] = None


class CostEntry(CostEntryCreate):
    """Full cost entry record with metadata."""
    id: str
    service_name: str = Field(default="", description="Denormalized for display")
    created_at: str
    updated_at: str


# ── API Usage Log (auto-tracked per Claude call) ─────────────────────

class ApiUsageLog(BaseModel):
    """Granular per-call usage log for AI APIs.

    Written by the claude_client wrapper. Aggregated into CostEntry
    records at the end of each day or on demand.
    """
    id: str
    service_id: str
    timestamp: str
    model: str = Field(description="Model used, e.g. 'claude-sonnet-4-20250514'")
    tokens_input: int
    tokens_output: int
    cost_usd: float = Field(description="Calculated cost based on model pricing")
    endpoint: str = Field(default="", description="Which CC endpoint triggered this call")
    cache_read_tokens: int = Field(default=0)
    cache_write_tokens: int = Field(default=0)


# ── Summaries & Projections ──────────────────────────────────────────

class ServiceMonthlySummary(BaseModel):
    """Monthly cost summary for a single service."""
    service_id: str
    service_name: str
    category: CostCategory
    period: str
    total_cost: float
    budget: Optional[float] = None
    budget_pct: Optional[float] = Field(
        default=None,
        description="Percentage of budget used (0-100+)"
    )
    requests_count: int = 0
    tokens_total: int = 0
    trend: CostTrend = "stable"
    is_free_tier: bool = False


class MonthlySummary(BaseModel):
    """Full monthly cost summary across all services."""
    period: str
    total_cost: float
    total_budget: Optional[float] = None
    budget_pct: Optional[float] = None
    by_category: dict = Field(
        default_factory=dict,
        description="Cost totals keyed by CostCategory"
    )
    by_service: List[ServiceMonthlySummary] = []
    services_count: int = 0
    free_tier_count: int = 0


class CostProjection(BaseModel):
    """Forward-looking cost projection."""
    period: str = Field(description="Future period, e.g. '2026-04'")
    projected_cost: float
    confidence: Literal["high", "medium", "low"] = "medium"
    basis: str = Field(
        default="3-month average",
        description="How the projection was calculated"
    )


class DashboardWidget(BaseModel):
    """Compact summary for the homepage widget."""
    current_month: str
    mtd_cost: float = Field(description="Month-to-date spend")
    projected_month_end: float
    budget: Optional[float] = None
    budget_pct: Optional[float] = None
    top_service: str = Field(description="Highest-cost service this month")
    top_service_cost: float
    trend: CostTrend = "stable"
    month_over_month_pct: Optional[float] = Field(
        default=None,
        description="Percentage change vs last month"
    )
    services_active: int = 0
    free_tier_count: int = 0
