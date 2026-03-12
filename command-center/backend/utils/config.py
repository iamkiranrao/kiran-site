"""
Shared configuration constants for the Command Center backend.

Centralizes values that were previously duplicated across routers and services:
- API key resolution (was copy-pasted in 6 routers)
- Claude model name (was hardcoded in 26 locations)
- Data directory paths (was using tempfile.gettempdir() which OS can clean)
"""

import os
import logging
from typing import Optional
from fastapi import HTTPException


# ── Logging ──────────────────────────────────────────────────────────────

def get_logger(name: str) -> logging.Logger:
    """Get a named logger for a service or router module."""
    return logging.getLogger(name)


# ── Claude Model ─────────────────────────────────────────────────────────

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")


# ── Data Directory ───────────────────────────────────────────────────────
# Persistent data dir — NOT tempdir (which OS can wipe).
# Override with COMMAND_CENTER_DATA_DIR env var for custom locations.

_default_data_dir = os.path.join(
    os.path.expanduser("~"), ".command-center", "data"
)
DATA_ROOT = os.getenv("COMMAND_CENTER_DATA_DIR", _default_data_dir)

# Ensure it exists on import
os.makedirs(DATA_ROOT, exist_ok=True)


def data_dir(subdir: str) -> str:
    """Get a persistent data directory for a specific subsystem.

    Example: data_dir("jobs") → ~/.command-center/data/jobs/
    """
    path = os.path.join(DATA_ROOT, subdir)
    os.makedirs(path, exist_ok=True)
    return path


# ── API Key Resolution ───────────────────────────────────────────────────

def resolve_api_key(header_key: Optional[str]) -> str:
    """Resolve Claude API key: prefer header, fall back to env var.

    This was previously duplicated across 6 router files as _resolve_api_key().
    Raises HTTPException(401) if no valid key is found.
    """
    if header_key and header_key.startswith("sk-ant-"):
        return header_key
    env_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if env_key and env_key.startswith("sk-ant-"):
        return env_key
    raise HTTPException(
        status_code=401,
        detail="No valid Claude API key found. Set ANTHROPIC_API_KEY in backend/.env or provide X-Claude-Key header.",
    )


# ── Valid Personas ───────────────────────────────────────────────────────

VALID_PERSONAS = {"PM", "PjM", "PMM", "auto"}
VALID_VERSIONS = {"1-Page", "2-Page", "Detailed"}
