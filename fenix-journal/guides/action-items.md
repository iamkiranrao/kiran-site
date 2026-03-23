---
module: action-items
title: Action Items
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Action Items

## Overview

Action Items is a unified task tracker for all work across Command Center and its associated projects. It consolidates actionable tasks from multiple sources — Cowork sessions (captured live when Kiran says "track this" or "action item"), manual creation in the dashboard, and API submissions — into a single, queryable backlog.

Unlike scattered todo lists or email threads, Action Items provides centralized visibility: filter by workstream (fenix, site-homepage, career, etc.), priority (critical, high, medium, low), or status (todo, in-progress, done, blocked). Each task includes a clear title, description, owning workstream, priority, source, and status. A summary endpoint provides high-level counts for dashboard widgets.

The system integrates directly with CLAUDE.md: when Kiran says "action item", "track this", "add a task", or "todo", it immediately POSTs to the Action Items API, capturing intent without breaking flow.

## Architecture

### Router & Storage

- **Router**: `backend/routers/action_items.py` — all CRUD operations and summary logic
- **Storage**: Supabase `action_items` table (indexed, queryable, persisted)

No separate service layer. The router handles all operations: create, read, update, delete, summary aggregation.

### Database Schema

Supabase `action_items` table:

```
id (uuid, pk)
user_id (uuid, fk to auth.users) — typically 'kiran' or system
title (text, not null) — short, actionable task title
description (text) — context on what needs to happen and why
workstream (text, not null) — from fixed enum below
priority (text, not null) — critical | high | medium | low
status (text, not null) — todo | in-progress | done | blocked
source (text) — 'session' | 'manual' | 'api' | 'migration'
created_at (timestamp)
updated_at (timestamp)
completed_at (timestamp, nullable) — when marked done
```

Indexes on: (workstream, status), (priority, status), (user_id, created_at)

### Workstreams

Action Items are organized by workstream (owning project or functional area). Fixed enum:

```
persona-picker        — Job search & resume customization
scannibal            — Competitor/content analysis tool
dia-fund             — Personal finance tracking
fenix                — Fenix AI assistant & training
command-center       — Command Center admin dashboard
site-homepage        — Main portfolio homepage
site-teardowns       — "How I'd've Built It" teardowns
site-blog            — Blog & long-form content
site-madlab          — MadLab prototype showcase
resume-pipeline      — Resume parsing & generation
wordweaver           — Content creation tool
platform-migration   — Technical refactoring/upgrades
fenix-training       — Training data ingestion & curation
infrastructure       — DevOps, deployment, monitoring
cross-cutting        — System-wide concerns (standards, docs)
creative-lab         — Design experiments
content              — Editorial planning & strategy
career               — Job search, interviews, positioning
```

When Kiran says "action item", he specifies or the Claude session infers the workstream. If ambiguous, default to `command-center` or ask.

### Priority Levels

| Priority | When to Use | SLA |
|----------|-----------|-----|
| **critical** | Blocks other work or has imminent deadline | This week |
| **high** | Important, high-value work | This week / next week |
| **medium** | Should be done, but no urgency | Next 2–3 weeks |
| **low** | Nice to have, backlog items | Anytime, after high/medium |

### Status Workflow

```
todo → in-progress → done
           ↓
         blocked → todo (when unblocked)
```

- **todo** — Not started
- **in-progress** — Actively being worked on
- **done** — Completed (automatically sets completed_at timestamp)
- **blocked** — Can't proceed (waiting on something external or dependency)

Blocked items can move back to todo once the blocker is removed.

### Source Field

Tracks where the action item originated:

- **session** — Created via Cowork ("action item", "track this", etc.)
- **manual** — Created via dashboard form
- **api** — Created via REST POST (programmatic)
- **migration** — Created during data migration or import

Useful for attribution and understanding patterns.

## REST API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/action-items` | GET | Fetch all items (supports ?workstream=fenix, ?priority=high, ?status=todo filters) |
| `/api/action-items` | POST | Create new action item |
| `/api/action-items/{id}` | GET | Fetch single item |
| `/api/action-items/{id}` | PATCH | Update status, priority, description |
| `/api/action-items/{id}` | DELETE | Archive/delete item |
| `/api/action-items/summary` | GET | Aggregated counts by status and workstream |

### Filtering & Querying

GET `/api/action-items` supports query parameters:

- `?workstream=fenix` — Filter by workstream
- `?priority=high` — Filter by priority
- `?status=in-progress` — Filter by status
- `?status=todo&priority=high` — Combine filters (AND logic)
- `?search=training` — Full-text search on title and description
- `?sort=created_at&order=desc` — Sort options (default: created_at desc)

### Summary Endpoint

`GET /api/action-items/summary` returns aggregated counts:

```json
{
  "total": 47,
  "by_status": {
    "todo": 23,
    "in-progress": 8,
    "done": 14,
    "blocked": 2
  },
  "by_priority": {
    "critical": 2,
    "high": 8,
    "medium": 15,
    "low": 22
  },
  "by_workstream": {
    "fenix": 12,
    "site-blog": 5,
    "career": 8,
    "command-center": 6,
    "other": 16
  },
  "critical_blocked": 0,
  "overdue": 1
}
```

Used for dashboard widgets (e.g., "8 high-priority tasks awaiting action").

### CLAUDE.md Integration

When Kiran says one of these phrases in a Cowork session, the Action Items API is called immediately:

- "action item: ..."
- "track this: ..."
- "add a task: ..."
- "todo: ..."
- "task: ..."

The request body:

```json
{
  "title": "Clear, actionable task title",
  "description": "Context on what needs to happen and why",
  "workstream": "command-center",
  "priority": "high",
  "source": "session",
  "status": "todo"
}
```

Example from a session:

```
User: "I need to wire Fenix to the Notification Center. action item: wire Fenix to notify on zero-result queries"

Claude (in background): POST /api/action-items/ with:
{
  "title": "Wire Fenix to notify on zero-result queries",
  "description": "When Fenix returns zero results or low-similarity match, create a fenix_dead_end notification. Helps identify content gaps.",
  "workstream": "fenix",
  "priority": "high",
  "source": "session"
}
```

The action item is created before the session ends, capturing intent in the moment. No manual todo entry needed afterward.

## Key Decisions

### Centralized vs. Distributed

Early iterations had todos scattered in tool-specific backlogs (Teardown Builder todos, Job Central todos, etc.). Consolidating into a unified tracker enables:

- Cross-cutting visibility (what's blocking progress across all projects?)
- Priority rebalancing (if fenix work is critical, reprioritize site-blog tasks)
- Workload capacity planning (how many critical items are in progress?)

### Source Field for Attribution

By tracking source, Kiran can understand patterns. E.g., "Most of my action items come from sessions, not manual entry — sessions are where decisions get crystallized."

### Status Over Due Dates

Action Items uses status (todo, in-progress, blocked) rather than due dates. This reflects Kiran's workflow: he works on what's highest priority, not what's due soonest. Status provides visibility into bottlenecks (blocked items accumulating).

**Future enhancement**: Add optional due dates for externally-imposed deadlines (e.g., interview on specific date).

### Workstream Enum Over Free-Form Labels

Workstreams are a fixed enum (not arbitrary tags). This enforces consistency (no "fenix-work" vs. "fenix" vs. "Fenix" confusion) and enables reliable aggregation. Queries and reports can assume workstreams are valid and consistent.

### Summary Endpoint for Dashboard Integration

Rather than fetching all items and counting in the frontend, the summary endpoint does aggregation server-side. More efficient, and the counts are always accurate.

## Evolution

### Initial Launch (Feb 20, 2026)

Launched with basic CRUD:

- Create, read, update, delete action items
- Supabase storage
- No session integration yet

### CLAUDE.md Integration (Mar 5, 2026)

- Integrated with CLAUDE.md (capture "action item" phrases live)
- source field added to track origin
- Workstream enum established and documented

### Dashboard Widget & Summary (Mar 12, 2026)

- Summary endpoint added for dashboard display
- Command Center dashboard shows task counts by priority and status
- Filtering UI added to view tasks by workstream or priority

### System Startup Integration (Mar 20, 2026 — Task 2)

- Action Items summary loaded on Command Center startup
- Dashboard displays live counts (refreshes when page loads)
- Blocked item detection and notification (if critical item is blocked >1 day, trigger alert)

## Current State

### Fully Functional

- CRUD operations (create, read, update, delete)
- Filtering by workstream, priority, status, search
- Summary aggregation (counts by status, priority, workstream)
- Live capture from Cowork sessions ("action item" phrases)
- Dashboard integration (task counts visible on main dashboard)
- Status workflow (todo → in-progress → done → archived)

### Data Quality

- Workstreams are controlled (fixed enum, no duplication)
- Priorities and statuses are normalized
- Source field provides attribution
- Full-text search on titles and descriptions

### Real-Time Awareness

- Action items created immediately when Cowork phrase is detected
- Summary endpoint returns live counts
- Dashboard reflects current state

## Known Issues & Limitations

### No Due Dates

Action Items tracks status but not deadlines. If an external deadline exists (e.g., "interview on March 25"), it must be recorded in the description, not as a separate field.

**Workaround**: Add optional `due_at` field to schema for items with hard deadlines.

### Blocked Item Tracking

Blocked items don't automatically unblock. If a dependency is resolved, someone must manually move the item back to todo.

**Future enhancement**: Track blocking relationships (item A blocks item B) and auto-suggest unblocking when blocker is done.

### No Time Estimation

Action Items don't include effort estimates (e.g., "8 hours"). Hard to capacity-plan or estimate completion timelines.

**Future enhancement**: Add `estimated_hours` field, then calculate "how long will all high-priority items take?"

### Manual Archive/Delete

Done items accumulate in the database. No automatic cleanup or archival to a historical table.

**Future enhancement**: Auto-archive done items older than 30 days (with a bulk "restore" option if needed).

### No Assigned-To Field

Action Items don't track who's responsible. In a multi-person team this would be critical. For Kiran alone, it's implicit, but worth noting for future scaling.

## Ideas & Future Direction

### Blocking & Dependencies

Model blocking relationships: "Item A cannot start until Item B is done." Auto-notify when blockers are resolved. Show critical path (sequence of items that determine project timeline).

### Effort Estimation & Burndown

Add `estimated_hours` and track actual time spent. Generate sprint burndown charts, velocity trends, and capacity forecasts.

### Recurring Tasks

Some items recur (e.g., "Weekly content audit", "Monthly cost review"). Support task templates and recurrence rules instead of manual re-creation.

### Calendar Integration

Sync action items with calendar. Hard deadlines show up as events. Long-running items show as multi-day blocks.

### Integration with Fenix

Fenix could suggest action items based on patterns: "You asked about this 3 times in the last week. Should I create a task to document it?"

### Bulk Actions

Archive all done items from 30 days ago. Bump all critical items to high. Reassign workstream for a batch of items.

### Email Digest

Send a daily summary: "3 critical items, 2 just unblocked, 1 completed today." Link directly to dashboard.

### Custom Workflows

Let Kiran define custom statuses (e.g., "on-deck" before in-progress, "in-review" before done). Or per-workstream status workflows (fenix has different stages than site-blog).
