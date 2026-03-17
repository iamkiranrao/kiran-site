"""
Knowledge Library API — Scans the project directory for Markdown files and serves
them as a browsable, searchable library with auto-generated summaries.
"""

import os
import re
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from utils.config import data_dir

router = APIRouter()

# ── Configuration ─────────────────────────────────────────────────
# Root of the Kiran's Website project — the parent of command-center/
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Directories/patterns to SKIP
SKIP_DIRS = {
    "node_modules", ".next", "venv", "__pycache__", ".git", ".DS_Store",
    "site-packages", ".expo", ".claude", ".claude-skills",
}

# Skip journal daily entries, session archives, and chat drops
SKIP_PATH_PATTERNS = [
    "fenix-journal/entries/about-kiran/",
    "fenix-journal/entries/build-journey/",
    "fenix-journal/session-archive/",
    "fenix-journal/raw/chat-drops/",
]

LIBRARY_CACHE = os.path.join(data_dir("library"), "library_cache.json")

# ── Category mapping ──────────────────────────────────────────────

CATEGORY_RULES = [
    # (path_contains, category, color)
    ("command-center/", "Command Center", "#fb923c"),
    ("fenix-journal/guides/", "Guides", "#8b5cf6"),
    ("fenix-journal/entries/connecting-threads/", "Connecting Threads", "#2dd4bf"),
    ("fenix-journal/", "Fenix Journal", "#2dd4bf"),
    ("prototypes/scannibal/", "Scannibal Prototype", "#67e8f9"),
    ("prototypes/", "Prototypes", "#67e8f9"),
    ("FENIX-", "Fenix", "#fb923c"),
    ("ARCHITECTURE", "Architecture", "#a78bfa"),
    ("MIGRATION", "Architecture", "#a78bfa"),
    ("resume", "Career", "#3b82f6"),
    ("RESUME", "Career", "#3b82f6"),
    ("GEICO", "Career", "#3b82f6"),
    ("job", "Career", "#3b82f6"),
    ("Interview", "Career", "#3b82f6"),
    ("teardown", "Content", "#f59e0b"),
    ("persona-picker", "Content", "#f59e0b"),
    ("midjourney", "Content", "#f59e0b"),
    ("botasaurusrex", "Content", "#f59e0b"),
    ("jurassic", "Content", "#f59e0b"),
    ("apple-pay", "Content", "#f59e0b"),
    ("demystifying", "Content", "#f59e0b"),
    ("VIDEO", "Content", "#f59e0b"),
    ("HERO", "Content", "#f59e0b"),
    ("CONTENT-RULES", "Content", "#f59e0b"),
    ("automation", "Strategy", "#22c55e"),
    ("Site Strategy", "Strategy", "#22c55e"),
    ("Site Audit", "Strategy", "#22c55e"),
    ("PROGRESS", "Strategy", "#22c55e"),
    ("SYSTEM-CONTEXT", "Strategy", "#22c55e"),
    ("URL-SLUG", "Strategy", "#22c55e"),
    ("FEEDBACK", "Strategy", "#22c55e"),
]


def _categorize(relative_path: str) -> tuple:
    """Return (category, color) for a file path."""
    for pattern, category, color in CATEGORY_RULES:
        if pattern in relative_path:
            return category, color
    return "General", "#94a3b8"


# ── Summary extraction ────────────────────────────────────────────

def _extract_summary(filepath: str, max_chars: int = 300) -> str:
    """Extract a short summary from the first meaningful lines of a markdown file."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return "Unable to read file."

    # Skip YAML frontmatter
    content_lines = []
    in_frontmatter = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if i == 0 and stripped == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue
        content_lines.append(stripped)

    # Gather first non-heading, non-empty lines as summary
    summary_parts = []
    chars = 0
    for line in content_lines:
        if not line:
            continue
        # Skip headings for summary text, but use title-level headings
        if line.startswith("#"):
            continue
        # Skip horizontal rules
        if re.match(r"^[-=*]{3,}$", line):
            continue
        # Clean markdown formatting
        clean = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)  # links
        clean = re.sub(r"[*_`]", "", clean)  # bold/italic/code
        clean = re.sub(r"^[-*+]\s+", "", clean)  # list markers

        summary_parts.append(clean)
        chars += len(clean)
        if chars >= max_chars:
            break

    summary = " ".join(summary_parts)
    if len(summary) > max_chars:
        summary = summary[:max_chars].rsplit(" ", 1)[0] + "..."
    return summary or "No summary available."


def _extract_title(filepath: str, filename: str) -> str:
    """Extract title from first heading or derive from filename."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith("# "):
                    return stripped[2:].strip()
                # Also check YAML title
                if stripped.startswith("title:"):
                    title = stripped[6:].strip().strip('"').strip("'")
                    if title:
                        return title
    except Exception:
        pass

    # Derive from filename
    name = os.path.splitext(filename)[0]
    # Convert kebab-case, snake_case, UPPER_CASE to title
    name = name.replace("-", " ").replace("_", " ")
    return name.title()


# ── Scanning ──────────────────────────────────────────────────────

def _should_skip(path: str) -> bool:
    """Check if a path should be skipped."""
    parts = path.split(os.sep)
    for part in parts:
        if part in SKIP_DIRS:
            return True
    for pattern in SKIP_PATH_PATTERNS:
        if pattern in path.replace(os.sep, "/"):
            return True
    return False


def _scan_files() -> List[dict]:
    """Scan for all eligible .md files and build library entries."""
    items = []
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Prune skip dirs
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue

            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, PROJECT_ROOT)

            if _should_skip(rel_path):
                continue

            # Get file stats
            try:
                stat = os.stat(full_path)
                modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                size_bytes = stat.st_size
            except Exception:
                modified = ""
                size_bytes = 0

            # Word count
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    word_count = len(f.read().split())
            except Exception:
                word_count = 0

            title = _extract_title(full_path, fname)
            summary = _extract_summary(full_path)
            category, color = _categorize(rel_path)

            # Generate stable ID from relative path
            item_id = hashlib.md5(rel_path.encode()).hexdigest()[:10]

            items.append({
                "id": item_id,
                "title": title,
                "filename": fname,
                "path": rel_path,
                "category": category,
                "color": color,
                "summary": summary,
                "word_count": word_count,
                "modified": modified,
                "size_bytes": size_bytes,
            })

    # Sort by category then title
    items.sort(key=lambda x: (x["category"], x["title"]))
    return items


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/")
def list_library(
    category: Optional[str] = None,
    search: Optional[str] = None,
):
    """List all library documents, optionally filtered by category or search term."""
    items = _scan_files()

    if category:
        items = [i for i in items if i["category"] == category]

    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i["title"].lower()
            or q in i["summary"].lower()
            or q in i["filename"].lower()
            or q in i["path"].lower()
        ]

    return {"items": items, "total": len(items)}


@router.get("/stats")
def library_stats():
    """Summary statistics for the library."""
    items = _scan_files()

    categories = {}
    total_words = 0
    for item in items:
        cat = item["category"]
        categories[cat] = categories.get(cat, 0) + 1
        total_words += item["word_count"]

    return {
        "total_files": len(items),
        "total_words": total_words,
        "categories": categories,
    }


@router.get("/categories")
def list_categories():
    """Return distinct categories with counts and colors."""
    items = _scan_files()
    categories = {}
    for item in items:
        cat = item["category"]
        if cat not in categories:
            categories[cat] = {"count": 0, "color": item["color"]}
        categories[cat]["count"] += 1
    return {"categories": categories}


@router.get("/{item_id}")
def get_library_item(item_id: str):
    """Get full content of a specific library document."""
    items = _scan_files()
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")

    full_path = os.path.join(PROJECT_ROOT, item["path"])
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    return {**item, "content": content}
