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

# Skip journal daily entries, session archives, chat drops, archived docs,
# old root-level docs (now reorganized into module folders), and old guides location
SKIP_PATH_PATTERNS = [
    "fenix-journal/entries/about-kiran/",
    "fenix-journal/entries/build-journey/",
    "fenix-journal/session-archive/",
    "fenix-journal/raw/chat-drops/",
    "fenix-journal/guides/",
    "docs/archive/",
    "docs/research/",
    "archive/",
]

# Old root-level doc files that have been moved into module folders — skip to avoid duplicates
OLD_ROOT_DOCS = {
    "ARCHITECTURE.md", "AUTHENTICITY-STANDARDS.md", "BACKEND-STANDARDS.md",
    "CONTENT-STANDARDS.md", "VISUAL-STANDARDS.md", "PLATFORM-MIGRATION.md",
    "SCANNIBAL.md", "DIA-FUND.md", "PERSONA-PICKER.md", "FENIX.md",
    "SITE-HOMEPAGE.md", "SITE-TEARDOWNS.md", "SITE-BLOG.md", "SITE-MADLAB.md",
    "SITE-CAREER.md", "SITE-STUDIO.md", "SITE-SUPPORT.md",
    "CC-ACTION-ITEMS.md", "CC-AUDITING.md", "CC-CORE.md", "CC-FENIX-JOURNAL.md",
    "CC-FENIX-TRAINING.md", "CC-KIRANS-JOURNAL.md", "CC-RESUME-PIPELINE.md",
    "CC-WORDWEAVER.md", "CC-TEARDOWNS.md",
    "AUDIT-REPORT-2026-03-20.md", "OVERNIGHT-REPORT-2026-03-20.md",
    "CONTINUATION-PROMPT-DASHBOARD-BUILD.md", "ACTION-ITEMS-PENDING.md",
}

LIBRARY_CACHE = os.path.join(data_dir("library"), "library_cache.json")

# ── Category mapping ──────────────────────────────────────────────
# Module-based categorization: derives category from folder structure under docs/
# Format: "TopLevel > SubModule" for nested folders, "TopLevel" for root-level

# Color palette for top-level modules
MODULE_COLORS = {
    "Website": "#34d399",
    "Command Center": "#fb923c",
    "Scannibal": "#67e8f9",
    "The DIA Fund": "#f472b6",
    "Persona Picker": "#e879f9",
    "Fenix": "#2dd4bf",
    "Foundation": "#a78bfa",
}

# Folder name → display name mapping
FOLDER_DISPLAY_NAMES = {
    "CommandCenter": "Command Center",
    "TheDiaFund": "The DIA Fund",
    "PersonaPicker": "Persona Picker",
    "ActionItems": "Action Items",
    "FenixJournal": "Fenix Journal",
    "FenixTraining": "Fenix Training",
    "FenixDashboard": "Fenix Dashboard",
    "KiransJournal": "Kiran's Journal",
    "ResumePipeline": "Resume Pipeline",
    "WordWeaver": "WordWeaver",
    "JobCentral": "Job Central",
    "SessionArchive": "Session Archive",
    "TechCosts": "Tech Costs",
    "MadLab": "MadLab",
}

# Legacy rules for files OUTSIDE the new docs/ folder structure
LEGACY_CATEGORY_RULES = [
    ("CLAUDE.md", "Foundation", "#a78bfa"),
    ("command-center/", "Command Center", "#fb923c"),
    ("fenix-journal/entries/connecting-threads/", "Connecting Threads", "#2dd4bf"),
    ("fenix-journal/entries/strategic-decisions/", "Strategic Decisions", "#d4a74a"),
    ("fenix-journal/", "Fenix Journal", "#2dd4bf"),
    ("prototypes/scannibal/", "Scannibal", "#67e8f9"),
    ("prototypes/", "Prototypes", "#67e8f9"),
    ("teardown", "Content", "#f59e0b"),
    ("blog/", "Content", "#f59e0b"),
]


def _categorize(relative_path: str) -> tuple:
    """Derive category from folder structure for docs/, fall back to legacy rules."""
    norm = relative_path.replace(os.sep, "/")

    # ── New folder-based categorization for docs/ ──
    if norm.startswith("docs/"):
        parts = norm.split("/")
        # parts[0] = "docs", parts[1] = top-level folder, parts[2] = sub-module (optional)
        if len(parts) >= 2 and parts[1] in FOLDER_DISPLAY_NAMES:
            top_level = FOLDER_DISPLAY_NAMES.get(parts[1], parts[1])
        elif len(parts) >= 2:
            top_level = parts[1]  # Already a clean name like "Website", "Fenix", etc.
        else:
            return "General", "#94a3b8"

        color = MODULE_COLORS.get(top_level, "#94a3b8")

        # Check for sub-module (e.g., docs/CommandCenter/Standards/)
        if len(parts) >= 3 and parts[2] and not parts[2].endswith(".md"):
            sub_name = FOLDER_DISPLAY_NAMES.get(parts[2], parts[2])
            return f"{top_level} > {sub_name}", color

        return top_level, color

    # ── Legacy rules for non-docs/ files ──
    for pattern, category, color in LEGACY_CATEGORY_RULES:
        if pattern in norm:
            return category, color

    return "General", "#94a3b8"


# ── Summary extraction ────────────────────────────────────────────

def _extract_summary(filepath: str, max_chars: int = 300) -> str:
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
    parts = path.split(os.sep)
    for part in parts:
        if part in SKIP_DIRS:
            return True
    norm = path.replace(os.sep, "/")
    for pattern in SKIP_PATH_PATTERNS:
        if pattern in norm:
            return True
    # Skip old root-level docs that have been reorganized into module folders
    if norm.startswith("docs/") and "/" not in norm[5:]:
        # This is a file directly in docs/ (not in a subfolder)
        filename = norm.split("/")[-1]
        if filename in OLD_ROOT_DOCS:
            return True
    return False


def _scan_files() -> List[dict]:
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

@router.get("/", response_model=dict)
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


@router.get("/stats", response_model=dict)
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


@router.get("/categories", response_model=dict)
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


@router.get("/{item_id}", response_model=dict)
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
