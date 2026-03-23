"""job_central data models."""

from pydantic import BaseModel
from typing import Any, Dict, Optional, List


class ApplicationEntry(BaseModel):
    company: str
    role: str
    tier: Optional[str] = "practice"
    url: Optional[str] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    tier: Optional[str] = None
    notes: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None  # event note


class InterviewDebrief(BaseModel):
    app_id: str
    interview_type: str  # phone, technical, behavioral, onsite, final
    interviewers: Optional[str] = None
    questions: Optional[List[str]] = None
    went_well: Optional[str] = None
    to_improve: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = 5


class ChecklistToggle(BaseModel):
    done: bool


class ChecklistAddItem(BaseModel):
    task: str
    category: Optional[str] = "custom"


class StoryEntry(BaseModel):
    title: str
    company: str
    content: str
    frameworks: Optional[List[str]] = None


class StoryUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    content: Optional[str] = None
    frameworks: Optional[List[str]] = None


class ContactEntry(BaseModel):
    name: str
    company: str
    role: Optional[str] = None
    status: Optional[str] = "not_contacted"
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class WeekPlanEntry(BaseModel):
    week_number: int
    title: str
    tasks: List[str]


class WeekTaskToggle(BaseModel):
    completed: bool


class DailyLogEntry(BaseModel):
    content: str


class ImportData(BaseModel):
    applications: Optional[List[Dict[str, Any]]] = None
    interviews: Optional[List[Dict[str, Any]]] = None
    stories: Optional[List[Dict[str, Any]]] = None
    contacts: Optional[List[Dict[str, Any]]] = None
    week_plans: Optional[List[Dict[str, Any]]] = None
    daily_logs: Optional[List[Dict[str, Any]]] = None


# ── Endpoints ──────────────────────────────────────────────────────
