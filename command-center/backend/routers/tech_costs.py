"""Tech Cost Calculator — track operational costs across the full tech stack.

Endpoints:
  Services:   GET/POST/PUT/DELETE /api/tech-costs/services
  Costs:      GET/POST/PUT/DELETE /api/tech-costs/entries
  Summaries:  GET /api/tech-costs/summary         (monthly breakdown)
  Widget:     GET /api/tech-costs/widget           (homepage compact view)
  Projection: GET /api/tech-costs/projection       (3-month forward look)
  API Usage:  GET /api/tech-costs/api-usage        (granular per-call logs)
  Aggregate:  POST /api/tech-costs/aggregate-usage (roll up API logs into cost entries)
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query

from models.tech_costs import (
    ServiceCreate, ServiceUpdate, Service,
    CostEntryCreate, CostEntryUpdate, CostEntry,
    ApiUsageLog,
    ServiceMonthlySummary, MonthlySummary, CostProjection, DashboardWidget,
)

router = APIRouter()

# ── Data directory ────────────────────────────────────────────────────

DATA_ROOT = os.environ.get(
    "COMMAND_CENTER_DATA_DIR",
    os.path.join(os.path.expanduser("~"), ".command-center", "data"),
)
COSTS_DIR = os.path.join(DATA_ROOT, "tech-costs")

SERVICES_FILE = os.path.join(COSTS_DIR, "services.json")
ENTRIES_FILE = os.path.join(COSTS_DIR, "entries.json")
USAGE_FILE = os.path.join(COSTS_DIR, "api-usage.json")

# Seed file path (shipped with repo for initial data)
SEED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "tech-costs")


def _ensure_dir():
    os.makedirs(COSTS_DIR, exist_ok=True)


def _load(filepath: str) -> list:
    """Load JSON list from file, falling back to seed file."""
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            return json.load(f)
    # Try seed file
    seed = os.path.join(SEED_DIR, os.path.basename(filepath))
    if os.path.exists(seed):
        with open(seed, "r") as f:
            data = json.load(f)
        # Copy seed to data dir for future use
        _ensure_dir()
        _save(filepath, data)
        return data
    return []


def _save(filepath: str, data: list):
    _ensure_dir()
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())[:8]


def _current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ── Model pricing loaded from data/tech-costs/rate-card.json ─────────

_RATE_CARD_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "tech-costs", "rate-card.json"
)

def _load_model_pricing() -> dict:
    try:
        with open(_RATE_CARD_PATH, "r") as f:
            card = json.load(f)
        merged = {}
        for provider_pricing in card.values():
            if isinstance(provider_pricing, dict) and not provider_pricing.get("_comment"):
                merged.update(provider_pricing)
        return merged
    except (IOError, json.JSONDecodeError):
        return {}

MODEL_PRICING = _load_model_pricing()


def _estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = MODEL_PRICING.get(model, {"input": 3.0, "output": 15.0})
    cost = (input_tokens * pricing["input"] / 1_000_000) + \
           (output_tokens * pricing["output"] / 1_000_000)
    return round(cost, 6)


# ══════════════════════════════════════════════════════════════════════
# SERVICES — Register tech stack components
# ══════════════════════════════════════════════════════════════════════

@router.get("/services", response_model=List[Service])
def list_services(
    category: Optional[str] = Query(None, description="Filter by category"),
    active_only: bool = Query(True, description="Only show active services"),
):
    """List all registered services in the tech stack."""
    services = _load(SERVICES_FILE)
    if active_only:
        services = [s for s in services if s.get("active", True)]
    if category:
        services = [s for s in services if s.get("category") == category]
    return services


@router.post("/services", response_model=Service, status_code=201)
def create_service(body: ServiceCreate):
    """Register a new service in the tech stack."""
    services = _load(SERVICES_FILE)
    now = _now()
    record = {
        "id": _new_id(),
        **body.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    services.append(record)
    _save(SERVICES_FILE, services)
    return record


@router.put("/services/{service_id}", response_model=Service)
def update_service(service_id: str, body: ServiceUpdate):
    """Update a service's details."""
    services = _load(SERVICES_FILE)
    for i, s in enumerate(services):
        if s["id"] == service_id:
            updates = body.model_dump(exclude_none=True)
            services[i].update(updates)
            services[i]["updated_at"] = _now()
            _save(SERVICES_FILE, services)
            return services[i]
    raise HTTPException(status_code=404, detail=f"Service {service_id} not found")


@router.delete("/services/{service_id}", response_model=dict)
def delete_service(service_id: str):
    """Remove a service from the tech stack."""
    services = _load(SERVICES_FILE)
    original_len = len(services)
    services = [s for s in services if s["id"] != service_id]
    if len(services) == original_len:
        raise HTTPException(status_code=404, detail=f"Service {service_id} not found")
    _save(SERVICES_FILE, services)
    return {"status": "deleted", "id": service_id}


# ══════════════════════════════════════════════════════════════════════
# COST ENTRIES — Manual or auto-tracked cost records
# ══════════════════════════════════════════════════════════════════════

@router.get("/entries", response_model=List[CostEntry])
def list_entries(
    service_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="Filter by period, e.g. '2026-03'"),
    source: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    """List cost entries with optional filters."""
    entries = _load(ENTRIES_FILE)
    if service_id:
        entries = [e for e in entries if e.get("service_id") == service_id]
    if period:
        entries = [e for e in entries if e.get("period") == period]
    if source:
        entries = [e for e in entries if e.get("source") == source]
    # Sort by period desc, then created_at desc
    entries.sort(key=lambda e: (e.get("period", ""), e.get("created_at", "")), reverse=True)
    return entries[:limit]


@router.post("/entries", response_model=CostEntry, status_code=201)
def create_entry(body: CostEntryCreate):
    """Log a cost entry."""
    services = _load(SERVICES_FILE)
    service = next((s for s in services if s["id"] == body.service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail=f"Service {body.service_id} not found")

    entries = _load(ENTRIES_FILE)
    now = _now()
    record = {
        "id": _new_id(),
        **body.model_dump(),
        "service_name": service["name"],
        "created_at": now,
        "updated_at": now,
    }
    entries.append(record)
    _save(ENTRIES_FILE, entries)
    return record


@router.post("/entries/bulk", status_code=201, response_model=dict)
def create_entries_bulk(entries_list: List[CostEntryCreate]):
    """Log multiple cost entries at once."""
    services = {s["id"]: s for s in _load(SERVICES_FILE)}
    entries = _load(ENTRIES_FILE)
    now = _now()
    created = []
    for body in entries_list:
        service = services.get(body.service_id)
        if not service:
            continue
        record = {
            "id": _new_id(),
            **body.model_dump(),
            "service_name": service["name"],
            "created_at": now,
            "updated_at": now,
        }
        entries.append(record)
        created.append(record)
    _save(ENTRIES_FILE, entries)
    return {"created": len(created), "entries": created}


@router.put("/entries/{entry_id}", response_model=CostEntry)
def update_entry(entry_id: str, body: CostEntryUpdate):
    """Update a cost entry."""
    entries = _load(ENTRIES_FILE)
    for i, e in enumerate(entries):
        if e["id"] == entry_id:
            updates = body.model_dump(exclude_none=True)
            entries[i].update(updates)
            entries[i]["updated_at"] = _now()
            _save(ENTRIES_FILE, entries)
            return entries[i]
    raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")


@router.delete("/entries/{entry_id}", response_model=dict)
def delete_entry(entry_id: str):
    """Remove a cost entry."""
    entries = _load(ENTRIES_FILE)
    original_len = len(entries)
    entries = [e for e in entries if e["id"] != entry_id]
    if len(entries) == original_len:
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")
    _save(ENTRIES_FILE, entries)
    return {"status": "deleted", "id": entry_id}


# ══════════════════════════════════════════════════════════════════════
# API USAGE LOG — Granular per-call tracking
# ══════════════════════════════════════════════════════════════════════

@router.get("/api-usage", response_model=dict)
def list_api_usage(
    service_id: Optional[str] = Query(None),
    since: Optional[str] = Query(None, description="ISO timestamp — only logs after this"),
    limit: int = Query(200, ge=1, le=2000),
):
    """List granular API usage logs."""
    logs = _load(USAGE_FILE)
    if service_id:
        logs = [l for l in logs if l.get("service_id") == service_id]
    if since:
        logs = [l for l in logs if l.get("timestamp", "") >= since]
    logs.sort(key=lambda l: l.get("timestamp", ""), reverse=True)
    return logs[:limit]


@router.post("/api-usage", response_model=ApiUsageLog, status_code=201)
def log_api_usage(body: ApiUsageLog):
    """Log a single API call (called by claude_client wrapper)."""
    logs = _load(USAGE_FILE)
    logs.append(body.model_dump())
    _save(USAGE_FILE, logs)
    return body


@router.post("/aggregate-usage", response_model=dict)
def aggregate_usage(
    period: Optional[str] = Query(None, description="Period to aggregate, e.g. '2026-03'. Defaults to current month."),
):
    """Roll up API usage logs into cost entries for a period.

    Groups by service_id + period, sums tokens and costs,
    creates/updates a CostEntry with source='auto-tracked'.
    """
    target_period = period or _current_period()
    logs = _load(USAGE_FILE)
    services = {s["id"]: s for s in _load(SERVICES_FILE)}

    # Group by service_id
    by_service: dict = {}
    for log in logs:
        ts = log.get("timestamp", "")
        if not ts.startswith(target_period):
            continue
        sid = log.get("service_id", "")
        if sid not in by_service:
            by_service[sid] = {
                "tokens_input": 0,
                "tokens_output": 0,
                "cost": 0.0,
                "count": 0,
            }
        by_service[sid]["tokens_input"] += log.get("tokens_input", 0)
        by_service[sid]["tokens_output"] += log.get("tokens_output", 0)
        by_service[sid]["cost"] += log.get("cost_usd", 0.0)
        by_service[sid]["count"] += 1

    # Create or update entries
    entries = _load(ENTRIES_FILE)
    now = _now()
    created = 0
    updated = 0

    for sid, agg in by_service.items():
        service = services.get(sid, {})
        # Find existing auto-tracked entry for this service + period
        existing = None
        for e in entries:
            if (e.get("service_id") == sid and
                e.get("period") == target_period and
                e.get("source") == "auto-tracked"):
                existing = e
                break

        if existing:
            existing["amount_usd"] = round(agg["cost"], 4)
            existing["tokens_input"] = agg["tokens_input"]
            existing["tokens_output"] = agg["tokens_output"]
            existing["requests_count"] = agg["count"]
            existing["description"] = f"Auto-aggregated: {agg['count']} API calls"
            existing["updated_at"] = now
            updated += 1
        else:
            entries.append({
                "id": _new_id(),
                "service_id": sid,
                "service_name": service.get("name", sid),
                "amount_usd": round(agg["cost"], 4),
                "description": f"Auto-aggregated: {agg['count']} API calls",
                "period": target_period,
                "tokens_input": agg["tokens_input"],
                "tokens_output": agg["tokens_output"],
                "requests_count": agg["count"],
                "source": "auto-tracked",
                "created_at": now,
                "updated_at": now,
            })
            created += 1

    _save(ENTRIES_FILE, entries)
    return {
        "period": target_period,
        "services_processed": len(by_service),
        "entries_created": created,
        "entries_updated": updated,
    }


# ══════════════════════════════════════════════════════════════════════
# SUMMARY — Monthly breakdown across all services
# ══════════════════════════════════════════════════════════════════════

@router.get("/summary", response_model=MonthlySummary)
def get_monthly_summary(
    period: Optional[str] = Query(None, description="Period, e.g. '2026-03'. Defaults to current month."),
):
    """Get a full monthly cost breakdown by category and service."""
    target_period = period or _current_period()
    services = _load(SERVICES_FILE)
    entries = _load(ENTRIES_FILE)

    # Filter entries for period
    period_entries = [e for e in entries if e.get("period") == target_period]

    # Get previous period for trend calculation
    year, month = int(target_period[:4]), int(target_period[5:7])
    if month == 1:
        prev_period = f"{year - 1}-12"
    else:
        prev_period = f"{year}-{month - 1:02d}"
    prev_entries = [e for e in entries if e.get("period") == prev_period]

    # Build service lookup
    service_map = {s["id"]: s for s in services}

    # Aggregate by service
    by_service_agg: dict = {}
    for entry in period_entries:
        sid = entry.get("service_id", "")
        if sid not in by_service_agg:
            svc = service_map.get(sid, {})
            by_service_agg[sid] = {
                "service_id": sid,
                "service_name": entry.get("service_name", svc.get("name", sid)),
                "category": svc.get("category", "other"),
                "total_cost": 0.0,
                "budget": svc.get("monthly_budget"),
                "requests_count": 0,
                "tokens_total": 0,
                "is_free_tier": svc.get("is_free_tier", False),
            }
        by_service_agg[sid]["total_cost"] += entry.get("amount_usd", 0)
        by_service_agg[sid]["requests_count"] += entry.get("requests_count", 0) or 0
        by_service_agg[sid]["tokens_total"] += (
            (entry.get("tokens_input", 0) or 0) +
            (entry.get("tokens_output", 0) or 0)
        )

    # Previous period by service for trend
    prev_by_service: dict = {}
    for entry in prev_entries:
        sid = entry.get("service_id", "")
        prev_by_service[sid] = prev_by_service.get(sid, 0) + entry.get("amount_usd", 0)

    # Build service summaries
    service_summaries = []
    for sid, agg in by_service_agg.items():
        budget_pct = None
        if agg["budget"] and agg["budget"] > 0:
            budget_pct = round((agg["total_cost"] / agg["budget"]) * 100, 1)

        prev_cost = prev_by_service.get(sid, 0)
        if prev_cost == 0 and agg["total_cost"] > 0:
            trend = "new"
        elif agg["total_cost"] > prev_cost * 1.15:
            trend = "rising"
        elif agg["total_cost"] < prev_cost * 0.85:
            trend = "falling"
        else:
            trend = "stable"

        service_summaries.append(ServiceMonthlySummary(
            service_id=sid,
            service_name=agg["service_name"],
            category=agg["category"],
            period=target_period,
            total_cost=round(agg["total_cost"], 2),
            budget=agg["budget"],
            budget_pct=budget_pct,
            requests_count=agg["requests_count"],
            tokens_total=agg["tokens_total"],
            trend=trend,
            is_free_tier=agg["is_free_tier"],
        ))

    # Sort by cost descending
    service_summaries.sort(key=lambda s: s.total_cost, reverse=True)

    # Category totals
    by_category: dict = {}
    for s in service_summaries:
        by_category[s.category] = by_category.get(s.category, 0) + s.total_cost
    by_category = {k: round(v, 2) for k, v in by_category.items()}

    total_cost = round(sum(s.total_cost for s in service_summaries), 2)
    total_budget = sum(
        s.budget for s in service_summaries if s.budget is not None
    ) or None
    budget_pct = None
    if total_budget and total_budget > 0:
        budget_pct = round((total_cost / total_budget) * 100, 1)

    active_services = [s for s in services if s.get("active", True)]

    # Push notification if budget threshold exceeded
    if budget_pct is not None and budget_pct >= 80 and total_budget:
        try:
            from services.notification_service import notify_cost_alert
            notify_cost_alert(
                current_spend=total_cost,
                budget=total_budget,
                budget_pct=budget_pct,
                period=target_period,
            )
        except Exception:
            pass  # Never let notification failure break the cost summary

    return MonthlySummary(
        period=target_period,
        total_cost=total_cost,
        total_budget=total_budget,
        budget_pct=budget_pct,
        by_category=by_category,
        by_service=service_summaries,
        services_count=len(active_services),
        free_tier_count=sum(1 for s in active_services if s.get("is_free_tier", False)),
    )


# ══════════════════════════════════════════════════════════════════════
# WIDGET — Compact summary for homepage
# ══════════════════════════════════════════════════════════════════════

@router.get("/widget", response_model=DashboardWidget)
def get_widget():
    """Compact cost summary for the CC homepage widget."""
    current = _current_period()
    summary = get_monthly_summary(period=current)

    # Previous month for MoM comparison
    year, month = int(current[:4]), int(current[5:7])
    if month == 1:
        prev_period = f"{year - 1}-12"
    else:
        prev_period = f"{year}-{month - 1:02d}"
    prev_summary = get_monthly_summary(period=prev_period)

    # Month-over-month change
    mom_pct = None
    if prev_summary.total_cost > 0:
        mom_pct = round(
            ((summary.total_cost - prev_summary.total_cost) / prev_summary.total_cost) * 100,
            1
        )

    # Top service
    top = summary.by_service[0] if summary.by_service else None

    # Simple projection: current daily rate * days in month
    now = datetime.now(timezone.utc)
    day_of_month = now.day
    if day_of_month > 0 and summary.total_cost > 0:
        daily_rate = summary.total_cost / day_of_month
        import calendar
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        projected = round(daily_rate * days_in_month, 2)
    else:
        projected = summary.total_cost

    # Overall trend
    if mom_pct is not None:
        if mom_pct > 15:
            trend = "rising"
        elif mom_pct < -15:
            trend = "falling"
        else:
            trend = "stable"
    else:
        trend = "new"

    return DashboardWidget(
        current_month=current,
        mtd_cost=summary.total_cost,
        projected_month_end=projected,
        budget=summary.total_budget,
        budget_pct=summary.budget_pct,
        top_service=top.service_name if top else "None",
        top_service_cost=top.total_cost if top else 0,
        trend=trend,
        month_over_month_pct=mom_pct,
        services_active=summary.services_count,
        free_tier_count=summary.free_tier_count,
    )


# ══════════════════════════════════════════════════════════════════════
# PROJECTIONS — Forward-looking cost estimates
# ══════════════════════════════════════════════════════════════════════

@router.get("/projection", response_model=List[CostProjection])
def get_projections(
    months_ahead: int = Query(3, ge=1, le=12, description="How many months to project"),
):
    """Project future costs based on historical data.

    Uses a weighted average of the last 3 months (most recent month
    weighted 3x, previous 2x, before that 1x).
    """
    current = _current_period()
    entries = _load(ENTRIES_FILE)

    # Get costs for last 3 months
    year, month = int(current[:4]), int(current[5:7])
    historical: List[float] = []

    for i in range(3):
        m = month - i
        y = year
        if m <= 0:
            m += 12
            y -= 1
        period = f"{y}-{m:02d}"
        period_cost = sum(
            e.get("amount_usd", 0) for e in entries if e.get("period") == period
        )
        historical.append(period_cost)

    # Weighted average (recent months count more)
    weights = [3, 2, 1]
    total_weight = 0
    weighted_sum = 0
    for cost, weight in zip(historical, weights):
        if cost > 0:
            weighted_sum += cost * weight
            total_weight += weight

    if total_weight > 0:
        avg = weighted_sum / total_weight
        confidence = "high" if all(c > 0 for c in historical) else "medium"
        basis = f"Weighted average of {sum(1 for c in historical if c > 0)} months"
    else:
        avg = 0
        confidence = "low"
        basis = "No historical data"

    # Generate projections
    projections = []
    for i in range(1, months_ahead + 1):
        m = month + i
        y = year
        while m > 12:
            m -= 12
            y += 1
        period = f"{y}-{m:02d}"

        # Add slight growth assumption (2% per month for variable costs)
        growth_factor = 1.02 ** i
        projected = round(avg * growth_factor, 2)

        projections.append(CostProjection(
            period=period,
            projected_cost=projected,
            confidence=confidence,
            basis=basis,
        ))

    return projections
