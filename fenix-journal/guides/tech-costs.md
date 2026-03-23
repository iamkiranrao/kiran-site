---
module: tech-costs
title: Tech Cost Calculator
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Tech Cost Calculator

## Overview

Tech Cost Calculator is a real-time operational cost tracker for the full tech stack — API calls, hosting, databases, third-party services, and infrastructure. It consolidates usage data and pricing from multiple sources into monthly summaries, cost projections, and budget alerts.

The system tracks costs across five service categories: LLM APIs (Claude, GPT, open-source models), Cloud Infrastructure (Supabase, Netlify, AWS), Third-Party Services (job boards, content APIs, authentication), Development Tools (IDEs, monitoring, deployment), and Storage & Databases. Each service has a historical cost record, usage metrics, and projected monthly burn rate.

Monthly summaries and projections help Kiran understand operational efficiency, identify cost spikes, and plan budget allocation. Budget alerts fire at 80% of the monthly cap, preventing surprise overspend.

## Architecture

### Self-Contained Router

Unlike most tools in Command Center, Tech Costs is self-contained in a single router with no separate service layer:

- **Router**: `backend/routers/tech_costs.py` — handles all endpoints (no service dependency)
- **Storage**: JSON files (not Supabase), stored in `~/.command-center/data/tech-costs/`
- **Seeding**: Seed data in `backend/data/tech-costs/` for initial setup

This minimalist architecture keeps Tech Costs independent and portable. No database setup, no migrations, pure file-based storage.

### Data Files

Three JSON files manage all cost data:

#### 1. services.json

Catalog of all tracked services with metadata:

```json
{
  "services": [
    {
      "id": "claude-api",
      "name": "Claude API",
      "category": "llm-api",
      "provider": "Anthropic",
      "monthly_budget": 100,
      "status": "active"
    },
    {
      "id": "supabase",
      "name": "Supabase",
      "category": "database",
      "provider": "Supabase",
      "monthly_budget": 50,
      "status": "active"
    }
  ]
}
```

Fields: `id`, `name`, `category`, `provider`, `monthly_budget`, `status` (active/inactive), `notes`.

#### 2. entries.json

Historical cost records (one entry per service per month):

```json
{
  "entries": [
    {
      "id": "entry-001",
      "service_id": "claude-api",
      "month": "2026-03",
      "cost": 47.32,
      "usage_metric": "13.2M input tokens, 2.1M output tokens",
      "notes": "High usage during Fenix training phase"
    }
  ]
}
```

Fields: `id`, `service_id`, `month` (YYYY-MM), `cost`, `usage_metric`, `notes`.

#### 3. api-usage.json

Raw API call logs aggregated from `claude_client.py`:

```json
{
  "calls": [
    {
      "timestamp": "2026-03-20T14:30:15Z",
      "model": "claude-3-5-sonnet",
      "input_tokens": 1024,
      "output_tokens": 512,
      "cost": 0.0234
    }
  ]
}
```

Fields: `timestamp`, `model`, `input_tokens`, `output_tokens`, `cost`.

### Rate Card

`backend/data/tech-costs/rate-card.json` defines per-model pricing:

```json
{
  "models": {
    "claude-3-5-sonnet": {
      "input_per_1m": 3.00,
      "output_per_1m": 15.00
    },
    "claude-3-opus": {
      "input_per_1m": 15.00,
      "output_per_1m": 75.00
    },
    "gpt-4": {
      "input_per_1m": 30.00,
      "output_per_1m": 60.00
    }
  }
}
```

When calculating cost from token usage: `cost = (input_tokens / 1_000_000) * input_per_1m + (output_tokens / 1_000_000) * output_per_1m`

### API Usage Logging

`backend/claude_client.py` (or equivalent HTTP client wrapper) logs every API call:

```python
def call_claude(model, messages, **kwargs):
    response = client.messages.create(
        model=model,
        messages=messages,
        **kwargs
    )

    # Log usage to api-usage.json
    log_api_usage({
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cost": calculate_cost(response.usage, model)
    })

    return response
```

This happens automatically on every Claude API call, ensuring no usage is missed.

### REST API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tech-costs/services` | GET | List all services with current month's cost |
| `/api/tech-costs/services/{service_id}` | GET | Service details and historical costs |
| `/api/tech-costs/summary` | GET | Monthly summary (total spent, by category, by service) |
| `/api/tech-costs/projection` | GET | Projected monthly cost based on historical trend |
| `/api/tech-costs/entries` | POST | Add a cost entry manually |
| `/api/tech-costs/sync-api-usage` | POST | Aggregate API logs into monthly entries |
| `/api/tech-costs/widget` | GET | Compact widget for homepage (shows current month %, budget remaining) |

### Projection Engine

The projection engine uses a weighted average of the last 3 months with a conservative growth factor:

```
projected_cost = (
    (cost_month_3 * 1) +
    (cost_month_2 * 2) +
    (cost_month_1 * 3)
) / 6 * 1.02  # 2% monthly growth assumption
```

This gives more weight to recent months (assuming current usage is more representative than 3 months ago) and applies a 2% growth buffer to account for increasing volume.

### Budget Alerts

When a service's month-to-date cost reaches 80% of its monthly budget, a `cost_alert` notification is created:

```python
def check_budget_alerts():
    for service in get_active_services():
        current_cost = get_month_to_date_cost(service.id)
        budget_pct = (current_cost / service.monthly_budget) * 100
        if budget_pct >= 80:
            notify_cost_alert(
                service_id=service.id,
                pct=budget_pct,
                remaining=service.monthly_budget - current_cost
            )
```

Budget alerts are only created once per service per day (to avoid noise). Dismissed notifications don't re-trigger.

### Widget Endpoint for Homepage

`GET /api/tech-costs/widget` returns a compact summary for embedding on the homepage:

```json
{
  "current_month": "2026-03",
  "total_spent": 197.45,
  "budget": 300,
  "pct_used": 65.82,
  "remaining": 102.55,
  "status": "healthy"
}
```

Status values: healthy (0–70%), warning (70–85%), critical (85–100%), over-budget (>100%).

## Key Decisions

### JSON Files Over Database

Tech Costs uses JSON files instead of Supabase for simplicity and portability:

- No database setup or migrations
- Files are human-readable and easy to audit
- Can be versioned in git if needed
- Simpler backup and recovery

Tradeoff: No real-time sync across multiple machines. If Kiran runs Command Center on multiple devices, costs must be manually reconciled.

### Automatic API Usage Logging

All Claude API calls are logged automatically via the HTTP client wrapper. This prevents manual entry errors and ensures comprehensive tracking.

### Weighted Projection (Not Linear)

The 3-month weighted average (3x recent, 2x mid, 1x old) provides more realistic projections than a simple average because recent usage is more likely to be representative of current consumption patterns.

### Manual Entry Support

Services like Supabase, Netlify, or AWS are tracked via manual monthly entries (checked from invoices) rather than API logs. This acknowledges that not all services have programmatic usage APIs.

### Budget per Service, Not Global

Each service has its own monthly budget cap. This allows precise cost control (e.g., allocate $100 to Claude, $50 to Supabase) rather than a single global budget. Services over budget are flagged separately.

## Evolution

### Initial Implementation (Mar 10, 2026)

Launched with:

- Services catalog (Claude API, Supabase, Netlify, AWS, GitHub)
- Cost entry schema and storage
- Monthly summary endpoint
- Projection engine (3-month weighted average)

### API Integration (Mar 15, 2026)

Added automatic API usage logging:

- `claude_client.py` logs every Claude API call to `api-usage.json`
- Aggregation job sums daily logs into monthly entries
- Rate card system for multi-model pricing

### Notification Wiring (Mar 20, 2026)

- Budget alerts integrated with notification service
- Alert fires at 80% budget (configurable per service)
- `cost_alert` notification type added

### Startup Automation (Mar 20, 2026 — Task 2)

- Backend startup runs cost aggregation (syncs API logs into monthly entries)
- Ensures cost data is fresh on each launch

## Current State

### Fully Functional

- Service catalog with metadata and budgets
- Cost entry creation (manual) and retrieval
- Automatic API usage logging for Claude API
- Monthly aggregation and summary calculation
- Projection engine (weighted 3-month forecast)
- Budget alerts at 80% threshold
- Integration with notification service
- Widget endpoint for homepage embed
- Historical cost tracking (view costs by service, by month, by category)

### Data Accuracy

- Claude API usage tracked with 100% coverage (automatic logging)
- Other services tracked via manual invoices (checked monthly)
- Historical data preserved for trend analysis

### Real-Time Awareness

- Current month's cost updated on every API call (for Claude)
- Other services update when invoices are logged manually
- Projections refresh on every endpoint call

## Known Issues & Limitations

### Lag on Non-API Services

Services like Supabase or Netlify require manual invoice entry. If an invoice comes in late or is forgotten, the month's true cost won't be captured until logged. No automated pull from vendor APIs.

**Workaround**: Set a calendar reminder on the last day of each month to enter all service invoices.

### No Multi-Device Sync

JSON files are not automatically synced across machines. If Kiran runs Command Center on laptop and desktop, costs logged on one won't appear on the other until manually merged.

**Workaround**: Run Command Center on a single primary machine, or manually export/import JSON files between devices.

### Projection Assumption (2% Growth)

The projection engine assumes 2% monthly growth. If usage is declining or spiking, the projection will be inaccurate.

**Considerations**: Add a manual override to adjust growth assumption per service, or detect trend changes automatically.

### No Variance Analysis

The system tracks costs but doesn't compare against budget or prior months. No "spent $5 more than expected" or "up 10% from last month" insights.

**Future enhancement**: Add dashboard cards showing variance (budgeted vs. actual, month-over-month change).

### No Cost Attribution to Projects

All costs are attributed to services, not projects. If Kiran wants to know "how much did building Teardown Builder cost?", he can't drill down to that level.

**Future enhancement**: Add project tagging to entries, then aggregate by project.

## Ideas & Future Direction

### Vendor API Integration

For services with programmatic usage APIs (AWS CloudWatch, Netlify API, Supabase usage endpoints), auto-fetch costs instead of manual entry. Reduces lag and errors.

### Cost Anomaly Detection

Alert when a service's cost spikes (e.g., 50% higher than expected). Useful for catching runaway usage before it becomes a budget crisis.

### Cost Attribution to Features

Tag API calls (e.g., "Fenix training" or "Teardown generation") and aggregate costs by feature. Understand which features are expensive.

### Vendor Comparison

Add alternative vendors to the rate card (e.g., GPT-4 vs. Claude-3-opus). Enable quick cost comparison: "If I switched to GPT-4, how much would I save?"

### Renewal Reminders

For services with annual contracts or subscriptions, track renewal dates and alert before they auto-renew. Useful for canceling unused services.

### Cost Trend Reports

Generate a monthly report showing cost trends, top spenders, budget performance, and forecasts. Email it to Kiran or embed in a weekly digest.

### Budget Rebalancing

Suggest reallocating budgets across services based on actual usage. E.g., "Claude API used only 40% of budget, but AWS is overflowing. Rebalance?"

### Multi-Tier Alerts

Different alert thresholds: 50% (warning), 75% (urgent), 100% (over-budget). Different notification priorities or actions per tier.
