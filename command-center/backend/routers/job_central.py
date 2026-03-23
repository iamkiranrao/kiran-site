"""
Job Central Router — Application tracking, interviews, checklists, reports, stories, networking, weekly plans.

Endpoints:
  GET    /                          — Sprint overview dashboard
  GET    /applications              — List applications (filterable)
  POST   /applications              — Add application
  GET    /applications/{id}         — Get single application
  PUT    /applications/{id}         — Update application
  DELETE /applications/{id}         — Delete application
  POST   /interview/debrief         — Log interview debrief
  GET    /interviews                — List interview debriefs
  GET    /checklist/daily           — Get today's checklist
  PUT    /checklist/{date}/{item_id} — Toggle checklist item
  POST   /checklist/{date}          — Add custom checklist item
  GET    /report/weekly             — Weekly progress report
  GET    /stories                   — List all stories (searchable)
  POST   /stories                   — Add a new story
  PUT    /stories/{story_id}        — Update a story
  DELETE /stories/{story_id}        — Delete a story
  GET    /contacts                  — List all networking contacts
  POST   /contacts                  — Add a new networking contact
  PUT    /contacts/{contact_id}     — Update a contact
  DELETE /contacts/{contact_id}     — Delete a contact
  GET    /plans                     — List all weekly plans (auto-seeds 12-week plan)
  POST   /plans                     — Add a new weekly plan
  PUT    /plans/{plan_id}/tasks/{task_id} — Toggle a task in a weekly plan
  DELETE /plans/{plan_id}           — Delete a weekly plan
  POST   /plans/seed                — Seed default 12-week plan
  GET    /logs                      — Get all daily progress logs
  GET    /logs/{date}               — Get daily log for a specific date
  POST   /logs/{date}               — Save daily progress log
  GET    /export                    — Export all data as JSON
  POST   /import                    — Import data from JSON backup
"""

from fastapi import APIRouter, HTTPException
from models.job_central import ApplicationEntry, ApplicationUpdate, InterviewDebrief, ChecklistToggle, ChecklistAddItem, StoryEntry, StoryUpdate, ContactEntry, ContactUpdate, WeekPlanEntry, WeekTaskToggle, DailyLogEntry, ImportData
from typing import Optional, List, Dict, Any

from services.job_central_service import (
    add_application,
    update_application,
    get_applications,
    get_application,
    delete_application,
    add_interview_debrief,
    get_interviews,
    get_daily_checklist,
    update_checklist_item,
    add_checklist_item,
    generate_weekly_report,
    get_sprint_overview,
    add_story,
    update_story,
    get_stories,
    delete_story,
    add_contact,
    update_contact,
    get_contacts,
    delete_contact,
    add_week_plan,
    get_week_plans,
    toggle_week_task,
    delete_week_plan,
    seed_week_plans,
    save_daily_log,
    get_daily_log,
    get_all_logs,
    export_all_data,
    import_all_data,
)

router = APIRouter()

# ── Request models ─────────────────────────────────────────────────

# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/", response_model=dict)
async def sprint_overview():
    """Get the 12-week sprint overview with all key metrics."""
    return get_sprint_overview()

@router.get("/applications", response_model=dict)
async def list_applications(
    tier: Optional[str] = None,
    status: Optional[str] = None,
):
    """List all tracked job applications."""
    apps = get_applications(tier=tier, status=status)
    return {"applications": apps, "count": len(apps)}

@router.post("/applications", response_model=dict)
async def create_application(entry: ApplicationEntry):
    """Add a new job application."""
    app = add_application(
        company=entry.company,
        role=entry.role,
        tier=entry.tier or "practice",
        url=entry.url,
        notes=entry.notes,
    )
    return app

@router.get("/applications/{app_id}", response_model=dict)
async def get_application_detail(app_id: str):
    """Get a single application with full event history."""
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    # Also include interviews for this application
    interviews = get_interviews(app_id=app_id)
    return {**app, "interviews": interviews}

@router.put("/applications/{app_id}", response_model=dict)
async def update_application_endpoint(app_id: str, updates: ApplicationUpdate):
    """Update an application's status, tier, or notes."""
    result = update_application(app_id, updates.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return result

@router.delete("/applications/{app_id}", response_model=dict)
async def delete_application_endpoint(app_id: str):
    """Delete an application."""
    if not delete_application(app_id):
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return {"deleted": app_id}

@router.post("/interview/debrief", response_model=dict)
async def create_interview_debrief(debrief: InterviewDebrief):
    """Log an interview debrief."""
    result = add_interview_debrief(
        app_id=debrief.app_id,
        interview_type=debrief.interview_type,
        interviewers=debrief.interviewers,
        questions=debrief.questions,
        went_well=debrief.went_well,
        to_improve=debrief.to_improve,
        notes=debrief.notes,
        rating=debrief.rating,
    )
    return result

@router.get("/interviews", response_model=dict)
async def list_interviews(app_id: Optional[str] = None):
    """List interview debriefs."""
    interviews = get_interviews(app_id=app_id)
    return {"interviews": interviews, "count": len(interviews)}

@router.get("/checklist/daily", response_model=dict)
async def daily_checklist(date: Optional[str] = None):
    """Get today's (or a specific date's) daily checklist."""
    return get_daily_checklist(for_date=date)

@router.put("/checklist/{for_date}/{item_id}", response_model=dict)
async def toggle_checklist_item(for_date: str, item_id: str, body: ChecklistToggle):
    """Toggle a checklist item's completion status."""
    result = update_checklist_item(for_date, item_id, body.done)
    if not result:
        raise HTTPException(status_code=404, detail="Checklist or item not found")
    return result

@router.post("/checklist/{for_date}", response_model=dict)
async def add_custom_checklist_item(for_date: str, body: ChecklistAddItem):
    """Add a custom item to a day's checklist."""
    result = add_checklist_item(for_date, body.task, body.category or "custom")
    if not result:
        raise HTTPException(status_code=404, detail="Could not add item")
    return result

@router.get("/report/weekly", response_model=dict)
async def weekly_report(week_start: Optional[str] = None):
    """Generate a weekly progress report."""
    return generate_weekly_report(week_start=week_start)

# ── Story Bank endpoints ──────────────────────────────────────────

@router.get("/stories", response_model=dict)
async def list_stories(search: Optional[str] = None):
    """List all interview stories, optionally filtered by search term."""
    stories = get_stories(search=search)
    return {"stories": stories, "count": len(stories)}

@router.post("/stories", response_model=dict)
async def create_story(entry: StoryEntry):
    """Create a new interview story with STAR framework."""
    return add_story(title=entry.title, company=entry.company, content=entry.content, frameworks=entry.frameworks)

@router.put("/stories/{story_id}", response_model=dict)
async def update_story_endpoint(story_id: str, updates: StoryUpdate):
    """Update an existing interview story."""
    result = update_story(story_id, updates.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail=f"Story {story_id} not found")
    return result

@router.delete("/stories/{story_id}", response_model=dict)
async def delete_story_endpoint(story_id: str):
    """Delete an interview story."""
    if not delete_story(story_id):
        raise HTTPException(status_code=404, detail=f"Story {story_id} not found")
    return {"deleted": story_id}

# ── Network endpoints ─────────────────────────────────────────────

@router.get("/contacts", response_model=dict)
async def list_contacts():
    """List all networking contacts."""
    contacts = get_contacts()
    return {"contacts": contacts, "count": len(contacts)}

@router.post("/contacts", response_model=dict)
async def create_contact(entry: ContactEntry):
    """Add a new networking contact."""
    return add_contact(name=entry.name, company=entry.company, role=entry.role, status=entry.status, notes=entry.notes)

@router.put("/contacts/{contact_id}", response_model=dict)
async def update_contact_endpoint(contact_id: str, updates: ContactUpdate):
    """Update a networking contact."""
    result = update_contact(contact_id, updates.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
    return result

@router.delete("/contacts/{contact_id}", response_model=dict)
async def delete_contact_endpoint(contact_id: str):
    """Delete a networking contact."""
    if not delete_contact(contact_id):
        raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
    return {"deleted": contact_id}

# ── Weekly Plan endpoints ─────────────────────────────────────────

@router.get("/plans", response_model=dict)
async def list_week_plans():
    """List all weekly plans, auto-seeding the 12-week plan if empty."""
    plans = get_week_plans()
    # Auto-seed 12-week plan if empty
    if not plans:
        plans = seed_week_plans()
    return {"plans": plans, "count": len(plans)}

@router.post("/plans", response_model=dict)
async def create_week_plan(entry: WeekPlanEntry):
    """Create a new weekly plan."""
    return add_week_plan(week_number=entry.week_number, title=entry.title, tasks=entry.tasks)

@router.post("/plans/seed", response_model=dict)
async def seed_plans():
    """Seed the default 12-week plan."""
    plans = seed_week_plans()
    return {"plans": plans, "count": len(plans)}

@router.put("/plans/{plan_id}/tasks/{task_id}", response_model=dict)
async def toggle_plan_task(plan_id: str, task_id: str, body: WeekTaskToggle):
    """Toggle task completion status in a weekly plan."""
    result = toggle_week_task(plan_id, task_id, body.completed)
    if not result:
        raise HTTPException(status_code=404, detail="Plan or task not found")
    return result

@router.delete("/plans/{plan_id}", response_model=dict)
async def delete_plan_endpoint(plan_id: str):
    """Delete a weekly plan."""
    if not delete_week_plan(plan_id):
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found")
    return {"deleted": plan_id}

# ── Daily Progress Log endpoints ─────────────────────────────────

@router.get("/logs", response_model=dict)
async def list_logs():
    """Get all daily progress logs."""
    logs = get_all_logs()
    return {"logs": logs, "count": len(logs)}

@router.get("/logs/{for_date}", response_model=dict)
async def get_log(for_date: str):
    """Get a daily progress log for a specific date."""
    log = get_daily_log(for_date)
    if not log:
        return {"date": for_date, "content": ""}
    return log

@router.post("/logs/{for_date}", response_model=dict)
async def create_log(for_date: str, body: DailyLogEntry):
    """Save a daily progress log."""
    return save_daily_log(for_date, body.content)

# ── Data Export / Import endpoints ───────────────────────────────

@router.get("/export", response_model=dict)
async def export_data():
    """Export all Job Central data as JSON backup."""
    return export_all_data()

@router.post("/import", response_model=dict)
async def import_data(data: ImportData):
    """Import Job Central data from a JSON backup."""
    return import_all_data(data.model_dump(exclude_none=True))
