---
module: notifications
title: Notification Center
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Notification Center

## Overview

The Notification Center is a unified inbox for actionable items across Command Center and its associated tools. It consolidates alerts, reminders, and status updates from 11+ distinct notification types into a single, deduplicated view — eliminating the need to check multiple dashboards or tools.

Every notification represents something Kiran should be aware of or act on: new feedback, training progress milestones, system health alerts, budget warnings, job opportunities, and more. Notifications are organized by priority (urgent, high, normal, low), can be dismissed, and automatically clean up after 90 days to prevent inbox bloat.

The architecture prioritizes correctness: notifications are deduplicated by type and reference ID (preventing duplicate alerts for the same event), helper functions follow a consistent pattern, and real-time badge updates keep the sidebar accurate without polling overhead.

## Architecture

### Backend Service

The notification system is built on two core components:

- **Service**: `backend/services/notification_service.py` contains the business logic for creating, querying, and archiving notifications
- **Router**: `backend/routers/notifications.py` exposes REST endpoints for the frontend

The service handles:

- Deduplication logic (checks if a notification of type X for reference_id Y already exists)
- Batch queries (fetch all unread, filter by priority, order by created timestamp)
- Dismissal and archival (soft delete for the 90-day auto-cleanup job)
- Helper function invocation (safe wrappers around `notify_*()` functions)

### Database Schema

Supabase `notifications` table structure:

```
id (uuid, pk)
user_id (uuid, fk to auth.users) — always 'system' or Kiran's user_id
type (text) — CHECK constraint enforces valid types
reference_id (text, nullable) — id of the object being notified about (e.g., job_id, feedback_id)
title (text) — short, actionable title
body (text) — full message or context
priority (text) — urgent | high | normal | low
read (boolean) — false until dismissed by user
dismissed_at (timestamp, nullable) — when dismissed
created_at (timestamp)
updated_at (timestamp)
```

The `type` column has a CHECK constraint (from migration 003) enforcing these 14 valid types:

```
feedback_new, testimonial_new, fenix_dead_end, content_freshness,
docs_drift, task_failure, training_progress, standards_violation,
job_match, interview_reminder, health_alert, cost_alert,
action_item, journal_entry
```

### Frontend Page

Located at `frontend/src/app/dashboard/notifications/page.tsx`:

- Lists all unread notifications (can filter by priority, type)
- Shows title, body, priority badge, and dismiss button
- Sidebar notification badge (updates via `/api/notifications/unread-count` polling every 60s)
- Clicking dismiss marks the notification as read and hides it from inbox

### Helper Functions Pattern

Notification types are triggered by helper functions in `backend/services/notification_helpers.py`. Each follows this pattern:

```python
def notify_job_match(job_id: str, title: str, company: str, **kwargs):
    """Create notification for a new job match."""
    # Check if we already notified about this job to prevent dupes
    existing = check_dedup(type="job_match", reference_id=job_id)
    if existing:
        return None  # Don't create duplicate

    return create_notification(
        type="job_match",
        reference_id=job_id,
        title=f"New match: {company}",
        body=f"{title} at {company}. Salary range: {kwargs.get('salary', 'TBD')}",
        priority="high"
    )
```

Built-in thresholds prevent notification spam:

- `notify_cost_alert()` only fires when budget is ≥80% consumed
- `notify_content_freshness()` only triggers for pages last updated >90 days ago
- `notify_docs_drift()` fires when docs/code are out of sync (detected by Standards service)

### Circular Import Prevention

Helper functions use lazy imports to avoid circular dependencies:

```python
def notify_training_progress():
    # Import only when called, not at module level
    from backend.services.fenix_service import get_training_stats
    stats = get_training_stats()
    # ...create notification
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/notifications` | GET | Fetch all notifications (supports ?priority=high, ?type=job_match filters) |
| `/api/notifications/unread-count` | GET | Return count of unread notifications (for sidebar badge) |
| `/api/notifications/{id}` | PATCH | Mark notification as read/dismissed |
| `/api/notifications/{id}` | DELETE | Permanently delete a notification |
| `/api/notifications/archive` | POST | Move dismissed notifications to archive table (runs nightly) |

## Key Decisions

### Unified vs. Distributed Notifications

Early iterations placed notifications inline in each tool (job alerts in Job Radar, cost alerts in Tech Costs, etc.). The unified approach centralizes them into one inbox because:

- Kiran can see everything at a glance
- Reduces context switching across dashboards
- Single source of truth for what needs action
- Easier to batch-process related items

### Deduplication by Type + Reference ID

Without deduplication, repeated events (e.g., checking a job listing 5 times) would create 5 notifications. The type+reference_id pair ensures one notification per unique event per day. The 90-day auto-cleanup prevents the inbox from becoming a historical archive.

### Sidebar Badge Polling (Not WebSocket)

The sidebar badge polls every 60s rather than using WebSocket. This decision trades real-time latency for simplicity:

- No persistent connection overhead
- Polling is resilient to backend restarts
- 60s latency is acceptable for most notifications
- Can be upgraded to WebSocket later if needed

### Priority Levels as a Filter, Not a Delivery Mechanism

All notifications are stored in the same table. Priority is metadata for filtering and sorting, not a mechanism that silently drops low-priority items. This ensures nothing is lost while allowing Kiran to focus on urgent items first.

### Helper Functions Over Direct Service Calls

Rather than inline notification creation scattered throughout the codebase, all notifications go through typed helper functions. This provides:

- A single point for adjusting thresholds (e.g., cost_alert threshold)
- Built-in deduplication logic per notification type
- Easier testing (mock the helpers, not the service)
- Clear audit trail of what triggers notifications

## Evolution

### Initial Implementation (Feb 2026)

Launched with 8 core notification types:

- `feedback_new` — Triggered by Feedback router when new feedback submitted
- `job_match` — From Job Radar when a job matches Kiran's criteria
- `task_failure` — When a scheduled task fails (from Task Service)
- `training_progress` — Fenix training data milestones (50, 100, 200 documents)
- `standards_violation` — New compliance violations detected
- `cost_alert` — Monthly tech costs exceed 80% of budget
- `interview_reminder` — Job Central interview scheduling
- `action_item` — New task added to action items list

### System Wiring Update (Mar 20, 2026 — Task 2)

Added 6 new notification types and wired them to existing services:

- `fenix_dead_end` — User query returned zero results or low relevance
- `content_freshness` — Content page hasn't been updated in 90+ days
- `docs_drift` — Documentation and code are out of sync (detected by Standards service)
- `health_alert` — System health check failed (backend, database, external APIs)
- `testimonial_new` — New testimonial submitted (from Feedback service)
- `journal_entry` — New Kiran's Journal entry created

Migration 003 expanded the CHECK constraint to include all 14 types.

### Current Wiring Status (Mar 20)

- Standards service → notification on new violations
- Job Radar → job_match notifications
- Job Central → interview_reminder notifications
- Fenix Dashboard → fenix_dead_end on zero-result queries
- Health checks → health_alert on failures
- Tech Costs service → cost_alert at 80% threshold
- Content audit → content_freshness on stale pages
- Task Service → task_failure on execution errors
- Action Items → action_item on creation
- Kiran's Journal → journal_entry on new entry
- Feedback router → feedback_new, testimonial_new
- Training data ingestion → training_progress milestones

## Current State

### Fully Functional

- Notification creation, deduplication, and storage
- REST API for fetching (with filters), dismissing, and archiving
- Sidebar unread count badge (polling every 60s)
- Dashboard notification inbox page (view all, filter by priority/type, dismiss)
- Helper functions for all 14 notification types
- 90-day auto-cleanup via background job
- Integration with 10+ services (Standards, Job Radar, Job Central, Fenix, Tech Costs, etc.)

### Real-Time Features

- Notifications created immediately when events occur
- Badge updates every 60 seconds
- Dismissed notifications hidden within the browser session

### Data Retention

- Active notifications: unlimited
- Dismissed notifications: move to archive after 90 days
- Archive table persisted indefinitely (for historical analysis)

## Known Issues & Limitations

### Polling Latency

The sidebar badge polls every 60 seconds. New notifications may not appear in the badge for up to a minute. If real-time notification is critical, upgrade to WebSocket-based updates.

**Workaround**: Manually refresh the page or wait up to 60 seconds for the badge to update.

### No Email Delivery

Notifications are dashboard-only. If Kiran is not actively viewing Command Center, he won't see them until the next session.

**Future enhancement**: Add email digest (daily or on-demand) for urgent notifications.

### Deduplication Window

Deduplication is currently per-day (new notifications with the same type+reference_id created >24h apart will generate two entries). This prevents alert fatigue but may miss important status updates if the same event recurs after a day.

**Considerations**: Could switch to never-dedup or extend to longer windows based on notification type.

### No Notification Actions

Notifications are read-only. You can dismiss them but can't take direct actions (e.g., "approve" or "ignore" from the notification). You must navigate to the relevant tool to act.

**Future enhancement**: Add action buttons (Approve, Ignore, Snooze) on notifications for faster workflows.

## Ideas & Future Direction

### Email Digest

Send a daily or weekly email summarizing all notifications (unread + archived) with a one-click link to the dashboard. Useful for staying aware without checking Command Center constantly.

### Smart Snooze

Add "Snooze for 1 hour / 1 day / 1 week" actions to notifications. Useful for deferring non-urgent items without dismissing them entirely.

### Notification Preferences

Let Kiran configure which notification types to receive, per-notification priority thresholds (e.g., only show cost alerts above 90%), and delivery channels (dashboard, email, Slack).

### Aggregation & Rollup

Group similar notifications (e.g., "3 new job matches" instead of 3 separate notifications). Useful when events cluster.

### Push Notifications

Native push notifications to desktop or mobile. Requires opt-in and platform-specific setup.

### Notification History & Trends

Analytics on notification frequency over time. Which notification types trigger most often? Are certain tools unusually quiet or noisy? Trends could inform operational decisions.
