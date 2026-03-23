"""
Tool Guides Service — reads and serves external tool guides from
docs/Foundation/ToolGuides/.

Each markdown file becomes a guide. The filename (minus .md) becomes the slug.
"""

import os
from typing import Optional, Dict, List

# ── Resolve paths ────────────────────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMMAND_CENTER = os.path.dirname(_BACKEND_DIR)
_REPO_ROOT = os.path.dirname(_COMMAND_CENTER)
GUIDES_DIR = os.path.join(_REPO_ROOT, "docs", "Foundation", "ToolGuides")


def _read_file(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def _extract_title(content: str) -> str:
    """Pull the first H1 from the markdown."""
    for line in content.split("\n"):
        if line.startswith("# "):
            return line[2:].strip()
    return "Untitled"


def _extract_summary(content: str) -> str:
    """Pull the first bold 'What it does for you' paragraph."""
    lines = content.split("\n")
    for line in lines:
        if line.startswith("**What it does for you:**"):
            return line.replace("**What it does for you:**", "").strip()
    # Fallback: first non-heading, non-empty line
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("---"):
            return stripped[:200]
    return ""


def _extract_sections(content: str) -> List[str]:
    """Return list of H2 section titles."""
    sections = []
    for line in content.split("\n"):
        if line.startswith("## "):
            sections.append(line[3:].strip())
    return sections


def _word_count(text: str) -> int:
    return len(text.split())


def list_tool_guides() -> Dict:
    """List all tool guides with metadata."""
    guides = []
    if not os.path.isdir(GUIDES_DIR):
        return {"guides": [], "count": 0}

    for fname in sorted(os.listdir(GUIDES_DIR)):
        if not fname.endswith(".md") or fname.startswith("_"):
            continue
        slug = fname[:-3]  # strip .md
        path = os.path.join(GUIDES_DIR, fname)
        content = _read_file(path)
        if not content:
            continue

        guides.append({
            "slug": slug,
            "title": _extract_title(content),
            "summary": _extract_summary(content),
            "sections": _extract_sections(content),
            "word_count": _word_count(content),
            "is_checklist": slug == "MAINTENANCE-CHECKLIST",
        })

    return {"guides": guides, "count": len(guides)}


def get_tool_guide(slug: str) -> Optional[Dict]:
    """Get full content of a specific tool guide."""
    path = os.path.join(GUIDES_DIR, f"{slug}.md")
    content = _read_file(path)
    if not content:
        return None

    return {
        "slug": slug,
        "title": _extract_title(content),
        "summary": _extract_summary(content),
        "sections": _extract_sections(content),
        "content": content,
        "word_count": _word_count(content),
    }
