"""
Job Central Service — Job search management, tracking, and automation.

Features:
- Application tracker with company tiers (dream / high-prob / practice)
- Interview debrief logging
- Daily checklists
- Weekly progress reports
- 12-week sprint tracking (target: 150-180 applications, 15-25 interviews)
- Data persistence to JSON files
"""

import json
import os
import uuid
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from collections import Counter

DATA_DIR = "/tmp/command-center/job-central"


# ── Data persistence helpers ──────────────────────────────────────

def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _apps_path() -> str:
    return os.path.join(DATA_DIR, "applications.json")


def _interviews_path() -> str:
    return os.path.join(DATA_DIR, "interviews.json")


def _checklist_path(d: str) -> str:
    return os.path.join(DATA_DIR, f"checklist-{d}.json")


def _load_json(path: str) -> list:
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def _save_json(path: str, data):
    _ensure_dir()
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ── Application tracking ─────────────────────────────────────────

VALID_TIERS = {"dream", "high-prob", "practice"}
VALID_STATUSES = {"applied", "screening", "interview", "offer", "rejected", "withdrawn", "ghosted"}


def add_application(
    company: str,
    role: str,
    tier: str = "practice",
    url: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """Add a new job application."""
    apps = _load_json(_apps_path())

    entry = {
        "id": str(uuid.uuid4())[:8],
        "company": company,
        "role": role,
        "tier": tier if tier in VALID_TIERS else "practice",
        "status": "applied",
        "url": url,
        "notes": notes,
        "applied_date": date.today().isoformat(),
        "updated_date": date.today().isoformat(),
        "events": [
            {"date": datetime.now().isoformat(), "type": "applied", "note": "Application submitted"}
        ],
    }

    apps.append(entry)
    _save_json(_apps_path(), apps)
    return entry


def update_application(app_id: str, updates: dict) -> Optional[dict]:
    """Update an application's status or details."""
    apps = _load_json(_apps_path())

    for app in apps:
        if app["id"] == app_id:
            if "status" in updates and updates["status"] in VALID_STATUSES:
                app["status"] = updates["status"]
                app["events"].append({
                    "date": datetime.now().isoformat(),
                    "type": updates["status"],
                    "note": updates.get("note", f"Status changed to {updates['status']}"),
                })
            if "tier" in updates and updates["tier"] in VALID_TIERS:
                app["tier"] = updates["tier"]
            if "notes" in updates:
                app["notes"] = updates["notes"]
            if "url" in updates:
                app["url"] = updates["url"]
            app["updated_date"] = date.today().isoformat()

            _save_json(_apps_path(), apps)
            return app

    return None


def get_applications(
    tier: Optional[str] = None,
    status: Optional[str] = None,
) -> List[Dict]:
    """Get all applications, optionally filtered."""
    apps = _load_json(_apps_path())

    if tier:
        apps = [a for a in apps if a["tier"] == tier]
    if status:
        apps = [a for a in apps if a["status"] == status]

    return sorted(apps, key=lambda a: a["updated_date"], reverse=True)


def get_application(app_id: str) -> Optional[dict]:
    """Get a single application by ID."""
    apps = _load_json(_apps_path())
    for app in apps:
        if app["id"] == app_id:
            return app
    return None


def delete_application(app_id: str) -> bool:
    """Delete an application."""
    apps = _load_json(_apps_path())
    original = len(apps)
    apps = [a for a in apps if a["id"] != app_id]
    if len(apps) < original:
        _save_json(_apps_path(), apps)
        return True
    return False


# ── Interview debriefs ────────────────────────────────────────────

def add_interview_debrief(
    app_id: str,
    interview_type: str,
    interviewers: Optional[str] = None,
    questions: Optional[List[str]] = None,
    went_well: Optional[str] = None,
    to_improve: Optional[str] = None,
    notes: Optional[str] = None,
    rating: Optional[int] = None,
) -> dict:
    """Log an interview debrief."""
    interviews = _load_json(_interviews_path())

    debrief = {
        "id": str(uuid.uuid4())[:8],
        "app_id": app_id,
        "interview_type": interview_type,
        "interviewers": interviewers,
        "questions": questions or [],
        "went_well": went_well,
        "to_improve": to_improve,
        "notes": notes,
        "rating": min(max(rating or 5, 1), 10),
        "date": datetime.now().isoformat(),
    }

    interviews.append(debrief)
    _save_json(_interviews_path(), interviews)

    # Also update the application's event log
    update_application(app_id, {
        "status": "interview",
        "note": f"{interview_type} interview completed",
    })

    return debrief


def get_interviews(app_id: Optional[str] = None) -> List[Dict]:
    """Get interview debriefs, optionally for a specific application."""
    interviews = _load_json(_interviews_path())
    if app_id:
        interviews = [i for i in interviews if i["app_id"] == app_id]
    return sorted(interviews, key=lambda i: i["date"], reverse=True)


# ── Daily checklist ───────────────────────────────────────────────

DEFAULT_CHECKLIST = [
    {"task": "Apply to 3 companies (minimum daily goal)", "category": "applications"},
    {"task": "Review and update 1 story in Story Bank", "category": "stories"},
    {"task": "Practice answering 1 PM interview question out loud", "category": "prep"},
    {"task": "Reach out to 1 connection on LinkedIn", "category": "networking"},
    {"task": "Review applications and follow up where needed", "category": "follow-up"},
]


# ── Default 12-week plan ────────────────────────────────────────

DEFAULT_WEEK_PLANS = [
    {"week_number": 1, "title": "Foundation - Contract Interview & Story Extraction", "tasks": [
        "Monday: Contract interview",
        "Story extraction session 1 (Wells Fargo)",
        "Story extraction session 2 (Frameworks)",
        "Apply to 15 companies (5 practice, 5 high-prob, 5 dream)",
        "Finish agent demo video",
    ]},
    {"week_number": 2, "title": "First Interview Wave", "tasks": [
        "Take 3-5 practice interviews",
        "Debrief each interview",
        "Apply to 10 more companies",
        "Activate 2-3 network connections",
        "Refine framework answers",
    ]},
    {"week_number": 3, "title": "Scale Applications", "tasks": [
        "Apply to 15 companies",
        "Take all interviews",
        "Practice CIRCLES framework",
        "Network outreach: 5 connections",
    ]},
    {"week_number": 4, "title": "Sharpen & Iterate", "tasks": [
        "Apply to 15 companies",
        "Debrief 5-7 interviews done",
        "Record yourself answering top 10 questions",
        "Update resume",
    ]},
    {"week_number": 5, "title": "Tier 2 Push", "tasks": [
        "Apply to Tier 2 (Adobe, Intuit, Snap, Airbnb)",
        "Network referrals",
        "Take 3-5 more interviews",
        "Showcase agent demo",
    ]},
    {"week_number": 6, "title": "Build Momentum", "tasks": [
        "Apply to 15 companies",
        "Assess after interview 10: What's working?",
        "Deep dive prep for Tier 2 interviews",
    ]},
    {"week_number": 7, "title": "Dream Company Activation", "tasks": [
        "Apply to Anthropic, Google, Apple",
        "Continue Tier 2 applications",
        "Network outreach at dream companies",
    ]},
    {"week_number": 8, "title": "Peak Performance", "tasks": [
        "15+ interviews completed",
        "Apply to remaining dream companies",
        "Manage multiple pipelines",
    ]},
    {"week_number": 9, "title": "Final Push", "tasks": [
        "Apply to remaining targets",
        "2-3 companies in final rounds",
        "Prepare for negotiations",
    ]},
    {"week_number": 10, "title": "Close Phase", "tasks": [
        "Final round interviews",
        "Evaluate offers",
        "Make decision",
    ]},
    {"week_number": 11, "title": "Negotiation & Decision", "tasks": [
        "Negotiate offer terms",
        "Accept offer",
        "Give notice on contract",
    ]},
    {"week_number": 12, "title": "Transition", "tasks": [
        "Prepare for new role",
        "Wrap up contract work",
        "Celebrate - you did it!",
    ]},
]


def get_daily_checklist(for_date: Optional[str] = None) -> dict:
    """Get or create today's daily checklist."""
    d = for_date or date.today().isoformat()
    path = _checklist_path(d)

    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)

    # Create new checklist
    checklist = {
        "date": d,
        "items": [
            {**item, "id": str(uuid.uuid4())[:6], "done": False}
            for item in DEFAULT_CHECKLIST
        ],
        "created_at": datetime.now().isoformat(),
    }

    _save_json(path, checklist)
    return checklist


def update_checklist_item(for_date: str, item_id: str, done: bool) -> Optional[dict]:
    """Toggle a checklist item."""
    path = _checklist_path(for_date)
    if not os.path.exists(path):
        return None

    with open(path) as f:
        checklist = json.load(f)

    for item in checklist["items"]:
        if item["id"] == item_id:
            item["done"] = done
            break

    _save_json(path, checklist)
    return checklist


# ── Weekly report ─────────────────────────────────────────────────

def generate_weekly_report(week_start: Optional[str] = None) -> dict:
    """Generate a weekly progress report."""
    if week_start:
        start = date.fromisoformat(week_start)
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday

    end = start + timedelta(days=6)
    start_str = start.isoformat()
    end_str = end.isoformat()

    apps = _load_json(_apps_path())
    interviews = _load_json(_interviews_path())

    # Applications this week
    week_apps = [a for a in apps if start_str <= a["applied_date"] <= end_str]
    all_active = [a for a in apps if a["status"] not in ("rejected", "withdrawn", "ghosted")]

    # Interviews this week
    week_interviews = [
        i for i in interviews
        if start_str <= i["date"][:10] <= end_str
    ]

    # Status breakdown
    status_counts = Counter(a["status"] for a in apps)
    tier_counts = Counter(a["tier"] for a in apps)

    # Calculate 12-week targets
    total_apps = len(apps)
    total_interviews = len(interviews)

    report = {
        "period": {"start": start_str, "end": end_str},
        "this_week": {
            "applications": len(week_apps),
            "interviews": len(week_interviews),
            "companies": list(set(a["company"] for a in week_apps)),
        },
        "totals": {
            "applications": total_apps,
            "interviews": total_interviews,
            "active": len(all_active),
            "target_apps": "150-180",
            "target_interviews": "15-25",
            "app_progress_pct": round((total_apps / 165) * 100, 1),
            "interview_progress_pct": round((total_interviews / 20) * 100, 1),
        },
        "by_status": dict(status_counts),
        "by_tier": dict(tier_counts),
        "pipeline": {
            "applied": status_counts.get("applied", 0),
            "screening": status_counts.get("screening", 0),
            "interview": status_counts.get("interview", 0),
            "offer": status_counts.get("offer", 0),
        },
        "conversion_rates": {
            "app_to_screen": _rate(status_counts.get("screening", 0) + status_counts.get("interview", 0) + status_counts.get("offer", 0), total_apps),
            "screen_to_interview": _rate(status_counts.get("interview", 0) + status_counts.get("offer", 0), status_counts.get("screening", 0) + status_counts.get("interview", 0) + status_counts.get("offer", 0)),
            "interview_to_offer": _rate(status_counts.get("offer", 0), status_counts.get("interview", 0) + status_counts.get("offer", 0)),
        },
    }

    return report


def _rate(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return "N/A"
    return f"{round((numerator / denominator) * 100, 1)}%"


# ── Sprint overview ───────────────────────────────────────────────

def get_sprint_overview() -> dict:
    """Get the 12-week sprint overview with progress metrics."""
    apps = _load_json(_apps_path())
    interviews = _load_json(_interviews_path())

    total_apps = len(apps)
    total_interviews = len(interviews)
    status_counts = Counter(a["status"] for a in apps)
    tier_counts = Counter(a["tier"] for a in apps)

    # Weekly breakdown
    weekly = {}
    for app in apps:
        week_num = date.fromisoformat(app["applied_date"]).isocalendar()[1]
        weekly.setdefault(week_num, 0)
        weekly[week_num] += 1

    return {
        "targets": {
            "applications": {"target": 165, "current": total_apps, "pct": round((total_apps / 165) * 100, 1)},
            "interviews": {"target": 20, "current": total_interviews, "pct": round((total_interviews / 20) * 100, 1)},
            "weekly_apps": {"target": 15, "current_week": weekly.get(date.today().isocalendar()[1], 0)},
        },
        "by_status": dict(status_counts),
        "by_tier": dict(tier_counts),
        "weekly_breakdown": dict(sorted(weekly.items())),
        "active_count": len([a for a in apps if a["status"] not in ("rejected", "withdrawn", "ghosted")]),
    }


# ── Story Bank ───────────────────────────────────────────────────

def _stories_path() -> str:
    return os.path.join(DATA_DIR, "stories.json")


def add_story(
    title: str,
    company: str,
    content: str,
    frameworks: Optional[List[str]] = None,
) -> dict:
    """Add a new story to the bank."""
    stories = _load_json(_stories_path())
    entry = {
        "id": str(uuid.uuid4())[:8],
        "title": title,
        "company": company,
        "content": content,
        "frameworks": frameworks or [],
        "created_date": datetime.now().isoformat(),
        "updated_date": datetime.now().isoformat(),
    }
    stories.append(entry)
    _save_json(_stories_path(), stories)
    return entry


def update_story(story_id: str, updates: dict) -> Optional[dict]:
    """Update a story."""
    stories = _load_json(_stories_path())
    for story in stories:
        if story["id"] == story_id:
            for key in ("title", "company", "content", "frameworks"):
                if key in updates:
                    story[key] = updates[key]
            story["updated_date"] = datetime.now().isoformat()
            _save_json(_stories_path(), stories)
            return story
    return None


def get_stories(search: Optional[str] = None) -> List[Dict]:
    """Get all stories, optionally filtered by search term."""
    stories = _load_json(_stories_path())
    if search:
        q = search.lower()
        stories = [s for s in stories if q in s["title"].lower() or q in s["content"].lower()
                    or any(q in f.lower() for f in s.get("frameworks", []))]
    return sorted(stories, key=lambda s: s.get("updated_date", ""), reverse=True)


def delete_story(story_id: str) -> bool:
    """Delete a story."""
    stories = _load_json(_stories_path())
    original = len(stories)
    stories = [s for s in stories if s["id"] != story_id]
    if len(stories) < original:
        _save_json(_stories_path(), stories)
        return True
    return False


# ── Network Tracker ──────────────────────────────────────────────

VALID_CONTACT_STATUSES = {"not_contacted", "reached_out", "meeting_scheduled", "referral_requested", "completed"}


def _contacts_path() -> str:
    return os.path.join(DATA_DIR, "contacts.json")


def add_contact(
    name: str,
    company: str,
    role: Optional[str] = None,
    status: str = "not_contacted",
    notes: Optional[str] = None,
) -> dict:
    """Add a new networking contact."""
    contacts = _load_json(_contacts_path())
    entry = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "company": company,
        "role": role,
        "status": status if status in VALID_CONTACT_STATUSES else "not_contacted",
        "notes": notes,
        "created_date": datetime.now().isoformat(),
        "updated_date": datetime.now().isoformat(),
    }
    contacts.append(entry)
    _save_json(_contacts_path(), contacts)
    return entry


def update_contact(contact_id: str, updates: dict) -> Optional[dict]:
    """Update a contact."""
    contacts = _load_json(_contacts_path())
    for contact in contacts:
        if contact["id"] == contact_id:
            for key in ("name", "company", "role", "notes"):
                if key in updates:
                    contact[key] = updates[key]
            if "status" in updates and updates["status"] in VALID_CONTACT_STATUSES:
                contact["status"] = updates["status"]
            contact["updated_date"] = datetime.now().isoformat()
            _save_json(_contacts_path(), contacts)
            return contact
    return None


def get_contacts() -> List[Dict]:
    """Get all networking contacts."""
    return _load_json(_contacts_path())


def delete_contact(contact_id: str) -> bool:
    """Delete a contact."""
    contacts = _load_json(_contacts_path())
    original = len(contacts)
    contacts = [c for c in contacts if c["id"] != contact_id]
    if len(contacts) < original:
        _save_json(_contacts_path(), contacts)
        return True
    return False


# ── Weekly Plans ─────────────────────────────────────────────────

def _week_plans_path() -> str:
    return os.path.join(DATA_DIR, "week_plans.json")


def add_week_plan(
    week_number: int,
    title: str,
    tasks: List[str],
) -> dict:
    """Add a new weekly plan."""
    plans = _load_json(_week_plans_path())
    entry = {
        "id": str(uuid.uuid4())[:8],
        "week_number": week_number,
        "title": title,
        "tasks": [{"id": str(uuid.uuid4())[:6], "description": t, "completed": False} for t in tasks],
        "created_date": datetime.now().isoformat(),
    }
    plans.append(entry)
    _save_json(_week_plans_path(), plans)
    return entry


def get_week_plans() -> List[Dict]:
    """Get all weekly plans."""
    plans = _load_json(_week_plans_path())
    return sorted(plans, key=lambda p: p.get("week_number", 0))


def toggle_week_task(plan_id: str, task_id: str, completed: bool) -> Optional[dict]:
    """Toggle a task in a weekly plan."""
    plans = _load_json(_week_plans_path())
    for plan in plans:
        if plan["id"] == plan_id:
            for task in plan["tasks"]:
                if task["id"] == task_id:
                    task["completed"] = completed
                    break
            _save_json(_week_plans_path(), plans)
            return plan
    return None


def delete_week_plan(plan_id: str) -> bool:
    """Delete a weekly plan."""
    plans = _load_json(_week_plans_path())
    original = len(plans)
    plans = [p for p in plans if p["id"] != plan_id]
    if len(plans) < original:
        _save_json(_week_plans_path(), plans)
        return True
    return False


def seed_week_plans() -> List[Dict]:
    """Seed the default 12-week plan if no plans exist."""
    existing = _load_json(_week_plans_path())
    if existing:
        return existing
    for wp in DEFAULT_WEEK_PLANS:
        add_week_plan(week_number=wp["week_number"], title=wp["title"], tasks=wp["tasks"])
    return _load_json(_week_plans_path())


# ── Custom checklist tasks ──────────────────────────────────────

def add_checklist_item(for_date: str, task: str, category: str = "custom") -> Optional[dict]:
    """Add a custom item to a day's checklist."""
    path = _checklist_path(for_date)
    if not os.path.exists(path):
        get_daily_checklist(for_date)  # create it first
    with open(path) as f:
        checklist = json.load(f)
    new_item = {"id": str(uuid.uuid4())[:6], "task": task, "category": category, "done": False}
    checklist["items"].append(new_item)
    _save_json(path, checklist)
    return checklist


# ── Daily progress log ──────────────────────────────────────────

def _logs_path() -> str:
    return os.path.join(DATA_DIR, "daily_logs.json")


def save_daily_log(for_date: str, content: str) -> dict:
    """Save a daily progress log entry."""
    logs = _load_json(_logs_path())
    # Update existing log for this date or add new one
    for log in logs:
        if log["date"] == for_date:
            log["content"] = content
            log["updated_at"] = datetime.now().isoformat()
            _save_json(_logs_path(), logs)
            return log
    entry = {
        "id": str(uuid.uuid4())[:8],
        "date": for_date,
        "content": content,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    logs.append(entry)
    _save_json(_logs_path(), logs)
    return entry


def get_daily_log(for_date: str) -> Optional[dict]:
    """Get a daily progress log entry."""
    logs = _load_json(_logs_path())
    for log in logs:
        if log["date"] == for_date:
            return log
    return None


def get_all_logs() -> List[Dict]:
    """Get all daily logs sorted by date."""
    logs = _load_json(_logs_path())
    return sorted(logs, key=lambda l: l["date"], reverse=True)


# ── Data export / import ────────────────────────────────────────

def export_all_data() -> dict:
    """Export all Job Central data for backup."""
    return {
        "exported_at": datetime.now().isoformat(),
        "applications": _load_json(_apps_path()),
        "interviews": _load_json(_interviews_path()),
        "stories": _load_json(_stories_path()),
        "contacts": _load_json(_contacts_path()),
        "week_plans": _load_json(_week_plans_path()),
        "daily_logs": _load_json(_logs_path()),
    }


def import_all_data(data: dict) -> dict:
    """Import Job Central data from a backup."""
    _ensure_dir()
    imported = {}
    if "applications" in data:
        _save_json(_apps_path(), data["applications"])
        imported["applications"] = len(data["applications"])
    if "interviews" in data:
        _save_json(_interviews_path(), data["interviews"])
        imported["interviews"] = len(data["interviews"])
    if "stories" in data:
        _save_json(_stories_path(), data["stories"])
        imported["stories"] = len(data["stories"])
    if "contacts" in data:
        _save_json(_contacts_path(), data["contacts"])
        imported["contacts"] = len(data["contacts"])
    if "week_plans" in data:
        _save_json(_week_plans_path(), data["week_plans"])
        imported["week_plans"] = len(data["week_plans"])
    if "daily_logs" in data:
        _save_json(_logs_path(), data["daily_logs"])
        imported["daily_logs"] = len(data["daily_logs"])
    return {"status": "imported", "counts": imported}
