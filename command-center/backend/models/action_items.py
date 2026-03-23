"""Action Items data models."""

from pydantic import BaseModel
from typing import Optional, List


VALID_WORKSTREAMS = [
    "persona-picker",
    "scannibal",
    "dia-fund",
    "fenix",
    "command-center",
    "site-homepage",
    "site-teardowns",
    "site-blog",
    "site-madlab",
    "site-career",
    "site-studio",
    "site-support",
    "resume-pipeline",
    "wordweaver",
    "fenix-journal",
    "fenix-training",
    "platform-migration",
    "infrastructure",
    "cross-cutting",
]


VALID_OWNERS = ["kiran", "claude", "joint", ""]


class ActionItemCreate(BaseModel):
    title: str
    description: str = ""
    workstream: str = "cross-cutting"           # One of VALID_WORKSTREAMS
    priority: str = "medium"                    # critical, high, medium, low
    source: str = ""                            # Where this came from (session filename, doc name, manual)
    due_date: Optional[str] = None              # ISO date string if time-sensitive
    tags: List[str] = []
    blocked_by: Optional[str] = None            # Description of what's blocking this
    owner: str = ""                             # kiran, claude, joint, or "" (unassigned)


class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    workstream: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None                # todo, in-progress, blocked, done, wont-do
    source: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[List[str]] = None
    blocked_by: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    owner: Optional[str] = None
