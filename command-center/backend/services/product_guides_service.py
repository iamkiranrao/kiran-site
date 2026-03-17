"""
Product Guides Service — reads and serves product module guides
from the fenix-journal/guides directory.
"""

import os
import re
from typing import Optional, Dict

# ── Resolve guides root ─────────────────────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMMAND_CENTER = os.path.dirname(_BACKEND_DIR)
_REPO_ROOT = os.path.dirname(_COMMAND_CENTER)
JOURNAL_ROOT = os.path.join(_REPO_ROOT, "fenix-journal")
GUIDES_DIR = os.path.join(JOURNAL_ROOT, "guides")


def _read_file(path: str) -> Optional[str]:
    """Safely read a file, return None if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def _parse_frontmatter(content: str) -> Dict:
    """Extract YAML frontmatter from markdown content."""
    meta = {}
    if not content.startswith("---"):
        return meta
    end = content.find("---", 3)
    if end < 0:
        return meta
    for line in content[3:end].strip().split("\n"):
        if ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip()
    return meta


def _word_count(text: str) -> int:
    return len(text.split())


def _extract_sections(content: str) -> Dict[str, str]:
    """Extract h2 sections from markdown content."""
    sections = {}
    body = content
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            body = content[end + 3:].strip()

    # Split on ## headers
    parts = re.split(r'^## ', body, flags=re.MULTILINE)
    for part in parts[1:]:  # skip everything before first ##
        lines = part.strip().split("\n", 1)
        if lines:
            header = lines[0].strip()
            content_text = lines[1].strip() if len(lines) > 1 else ""
            sections[header] = content_text
    return sections


def _has_real_content(section_text: str) -> bool:
    """Check if a section has real content vs just placeholder text."""
    placeholder_phrases = [
        "no data yet",
        "will be populated",
        "will be generated",
    ]
    lower = section_text.lower().strip()
    if not lower:
        return False
    return not any(phrase in lower for phrase in placeholder_phrases)


def list_guides() -> Dict:
    """List all product guides with metadata."""
    if not os.path.isdir(GUIDES_DIR):
        return {"guides": [], "total": 0}

    guides = []
    for fname in sorted(os.listdir(GUIDES_DIR)):
        if not fname.endswith(".md") or fname.startswith("_"):
            continue

        fpath = os.path.join(GUIDES_DIR, fname)
        content = _read_file(fpath)
        if not content:
            continue

        meta = _parse_frontmatter(content)
        sections = _extract_sections(content)

        # Count sections with real content
        populated = sum(1 for v in sections.values() if _has_real_content(v))
        total_sections = len(sections)

        guides.append({
            "slug": meta.get("module", fname.replace(".md", "")),
            "title": meta.get("title", fname.replace(".md", "").replace("-", " ").title()),
            "created": meta.get("created", ""),
            "last_updated": meta.get("last_updated", ""),
            "version": int(meta.get("version", 1)),
            "word_count": _word_count(content),
            "sections_populated": populated,
            "sections_total": total_sections,
            "filename": fname,
        })

    return {"guides": guides, "total": len(guides)}


def get_guide(slug: str) -> Optional[Dict]:
    """Get the full content of a specific guide."""
    fname = f"{slug}.md"

    # Prevent path traversal
    if "/" in slug or "\\" in slug or ".." in slug:
        return None

    fpath = os.path.join(GUIDES_DIR, fname)
    content = _read_file(fpath)
    if not content:
        return None

    meta = _parse_frontmatter(content)
    sections = _extract_sections(content)

    # Get body after frontmatter
    body = content
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            body = content[end + 3:].strip()

    populated = sum(1 for v in sections.values() if _has_real_content(v))

    return {
        "slug": meta.get("module", slug),
        "title": meta.get("title", slug.replace("-", " ").title()),
        "created": meta.get("created", ""),
        "last_updated": meta.get("last_updated", ""),
        "version": int(meta.get("version", 1)),
        "word_count": _word_count(content),
        "sections_populated": populated,
        "sections_total": len(sections),
        "content": body,
        "sections": {k: {"content": v, "has_data": _has_real_content(v)} for k, v in sections.items()},
    }


def get_guides_stats() -> Dict:
    """Return summary stats about the guides."""
    result = list_guides()
    guides = result["guides"]

    total_words = sum(g["word_count"] for g in guides)
    total_populated = sum(g["sections_populated"] for g in guides)
    total_sections = sum(g["sections_total"] for g in guides)

    return {
        "total_guides": len(guides),
        "total_words": total_words,
        "sections_populated": total_populated,
        "sections_total": total_sections,
        "completeness": round(total_populated / total_sections * 100) if total_sections > 0 else 0,
    }
